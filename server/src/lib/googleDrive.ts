import { logger } from './logger';
import { supabase } from './supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  expiry: number; // Unix timestamp ms
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${errBody}`);
  }

  const data: any = await res.json();
  const expiry = Date.now() + (data.expires_in || 3600) * 1000;
  return { access_token: data.access_token, expiry };
}

// ─── User Token Resolution ─────────────────────────────────────────────────

/**
 * Loads + auto-refreshes the Google access token for a given user.
 * Returns null if the user has no Google tokens stored.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', userId)
    .single();

  if (error || !profile?.google_access_token) {
    logger.warn(`[Drive] No Google access token stored for user ${userId}`);
    return null;
  }

  const { google_access_token, google_refresh_token, google_token_expiry } = profile;

  // If the access token is still valid (won't expire in the next 60s), use it directly.
  // This handles re-logins where Google doesn't return a new refresh_token.
  const isStillValid = google_token_expiry && Date.now() < (Number(google_token_expiry) - 60_000);
  if (isStillValid) {
    return google_access_token;
  }

  // Token expired — must refresh. Requires a stored refresh_token.
  if (!google_refresh_token) {
    logger.warn(`[Drive] Access token expired and no refresh token for user ${userId}. User must log in again.`);
    return null;
  }

  try {
    const refreshed = await refreshAccessToken(google_refresh_token);
    await supabase.from('profiles').update({
      google_access_token: refreshed.access_token,
      google_token_expiry: refreshed.expiry,
    }).eq('id', userId);
    logger.info(`[Drive] Refreshed access token for user ${userId}`);
    return refreshed.access_token;
  } catch (err: any) {
    logger.error(`[Drive] Token refresh failed for ${userId}:`, err.message);
    return null;
  }
}

// ─── Drive API Helpers ────────────────────────────────────────────────────────

async function driveRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const baseUrl = 'https://www.googleapis.com/drive/v3';
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Drive API error [${res.status}] ${res.statusText}: ${errBody}`);
  }

  // 204 No Content (e.g. delete)
  if (res.status === 204) return null;

  return res.json();
}

// ─── Folder Operations ────────────────────────────────────────────────────────

/**
 * Finds a folder by name under a parent folder, or creates it if missing.
 * Returns the folder ID.
 */
export async function ensureFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string> {
  // Build search query
  const parentClause = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents";
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}'${parentClause} and trashed=false`;

  const searchRes = await driveRequest(accessToken, `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`);

  if (searchRes.files && searchRes.files.length > 0) {
    return searchRes.files[0].id as string;
  }

  // Not found — create it
  const body: any = { name, mimeType: FOLDER_MIME };
  if (parentId) body.parents = [parentId];

  const created = await driveRequest(accessToken, '/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  logger.info(`[Drive] Created folder "${name}" (id: ${created.id})`);
  return created.id as string;
}

/**
 * Renames a Drive folder (or file).
 */
export async function renameItem(
  accessToken: string,
  fileId: string,
  newName: string
): Promise<void> {
  await driveRequest(accessToken, `/files/${fileId}?fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
  logger.info(`[Drive] Renamed item ${fileId} → "${newName}"`);
}

/**
 * Moves a file to a new parent folder, removing it from the old one.
 */
export async function moveFile(
  accessToken: string,
  fileId: string,
  newParentId: string,
  oldParentId: string
): Promise<void> {
  await driveRequest(
    accessToken,
    `/files/${fileId}?addParents=${newParentId}&removeParents=${oldParentId}&fields=id`,
    { method: 'PATCH' }
  );
  logger.info(`[Drive] Moved file ${fileId} to folder ${newParentId}`);
}

/**
 * Deletes a Drive item (file or folder). Silent if already gone.
 */
export async function deleteItem(accessToken: string, fileId: string): Promise<void> {
  try {
    await driveRequest(accessToken, `/files/${fileId}`, { method: 'DELETE' });
    logger.info(`[Drive] Deleted item ${fileId}`);
  } catch (err: any) {
    // 404 means already deleted — ignore
    if (!err.message.includes('404')) throw err;
  }
}

/**
 * Checks if a folder (or any subfolder recursively) contains actual files
 * (not folders). Returns true if any file exists anywhere in the subtree.
 */
async function hasFilesRecursively(accessToken: string, folderId: string): Promise<boolean> {
  try {
    // Look for any direct file children (non-folder items)
    const fileRes = await driveRequest(
      accessToken,
      `/files?q=${encodeURIComponent(`'${folderId}' in parents and mimeType!='${FOLDER_MIME}' and trashed=false`)}&fields=files(id)&pageSize=1`
    );
    if (fileRes.files && fileRes.files.length > 0) return true;

    // Recursively check each subfolder
    const subRes = await driveRequest(
      accessToken,
      `/files?q=${encodeURIComponent(`'${folderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`)}&fields=files(id)`
    );
    for (const sub of (subRes.files || [])) {
      if (await hasFilesRecursively(accessToken, sub.id)) return true;
    }
    return false;
  } catch {
    return true; // Err on the side of NOT deleting if we can't check
  }
}

/**
 * Gets the parent folder ID for a Drive item.
 * Returns null if not found or on error.
 */
export async function getParentFolderId(accessToken: string, itemId: string): Promise<string | null> {
  try {
    const res = await driveRequest(accessToken, `/files/${itemId}?fields=parents`);
    return res.parents?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * After a bill file is removed from a folder (deleted or moved away), cascades upward
 * through month → year → bill-type, deleting each level only if it contains no remaining
 * files anywhere in its subtree. Stops at the bill-type folder and never touches חשבונות or higher.
 *
 * Parent IDs are resolved BEFORE any deletions so deleted folders don't lose their pointers.
 */
export async function cleanupEmptyFolderCascade(
  accessToken: string,
  monthFolderId: string
): Promise<void> {
  // Resolve the entire parent chain up-front
  const yearFolderId = await getParentFolderId(accessToken, monthFolderId);
  const typeFolderId = yearFolderId ? await getParentFolderId(accessToken, yearFolderId) : null;

  for (const { id, label } of [
    { id: monthFolderId, label: 'month' },
    { id: yearFolderId,  label: 'year'  },
    { id: typeFolderId,  label: 'type'  },
  ]) {
    if (!id) break;
    try {
      if (!(await hasFilesRecursively(accessToken, id))) {
        await deleteItem(accessToken, id);
        logger.info(`[Drive] ♻️  Removed empty ${label} folder ${id}`);
      } else {
        break; // Folder still has files — parent levels won't be empty either
      }
    } catch (err: any) {
      logger.warn(`[Drive] Could not check/clean ${label} folder ${id}: ${err.message}`);
      break;
    }
  }
}

/**
 * Unified Drive cleanup: deletes the bill file then cascades empty-folder cleanup
 * from its parent month folder up to the bill-type directory.
 * This is the single canonical function for removing a Drive bill file from the app.
 */
export async function deleteBillFileAndCleanup(
  accessToken: string,
  fileId: string,
  monthFolderId: string
): Promise<void> {
  await deleteItem(accessToken, fileId);
  await cleanupEmptyFolderCascade(accessToken, monthFolderId);
}


// ─── File Upload ──────────────────────────────────────────────────────────────

/**
 * Uploads a file buffer to a Drive folder.
 * Returns the created Drive file ID.
 */
export async function uploadFile(
  accessToken: string,
  folderId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  // Multipart upload
  const metadata = JSON.stringify({ name: filename, parents: [folderId] });
  const boundary = `boundary_${Date.now()}`;

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Drive upload error [${res.status}]: ${errBody}`);
  }

  const data: any = await res.json();
  logger.info(`[Drive] Uploaded "${filename}" → file ID ${data.id}`);
  return data.id as string;
}

// ─── Path Builder ─────────────────────────────────────────────────────────────

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export function getMonthRangeLabel(startIso?: string, endIso?: string): string {
  if (!startIso) return 'ללא_תאריך';
  const d1 = new Date(startIso);
  const m1 = HEBREW_MONTHS[d1.getMonth()];
  if (endIso) {
    const d2 = new Date(endIso);
    const m2 = HEBREW_MONTHS[d2.getMonth()];
    if (m1 !== m2) return `${m1}-${m2}`;
  }
  return m1;
}

export function getBillYear(startIso?: string): string {
  if (!startIso) return 'ללא_שנה';
  return String(new Date(startIso).getFullYear());
}

export function buildDriveFilename(
  billType: string,
  startIso: string | undefined,
  endIso: string | undefined,
  originalName: string
): string {
  const year = getBillYear(startIso);
  const month = getMonthRangeLabel(startIso, endIso);
  return `${billType}_${year}_${month}_${originalName}`;
}

// ─── Folder Tree Builder ──────────────────────────────────────────────────────

export interface BillFolderPath {
  rootId: string;        // BillsPills
  propertyId: string;   // <property_name>
  billsId: string;      // חשבונות
  typeId: string;       // <bill_type>
  yearId: string;       // <year>
  monthId: string;      // <month_range>
}

/**
 * Ensures the complete folder tree exists for a bill and returns folder IDs at each level.
 */
export async function ensureBillFolderPath(
  accessToken: string,
  propertyName: string,
  billType: string,
  startIso: string | undefined,
  endIso: string | undefined,
  cachedPropertyFolderId?: string | null
): Promise<BillFolderPath> {
  const year = getBillYear(startIso);
  const month = getMonthRangeLabel(startIso, endIso);

  let rootId = '';
  let propertyFolderId = cachedPropertyFolderId || '';

  if (!propertyFolderId) {
    rootId = await ensureFolder(accessToken, 'BillsPills');
    propertyFolderId = await ensureFolder(accessToken, propertyName, rootId);
  }

  const billsFolderId = await ensureFolder(accessToken, 'חשבונות', propertyFolderId);
  const typeFolderId = await ensureFolder(accessToken, billType, billsFolderId);
  const yearFolderId = await ensureFolder(accessToken, year, typeFolderId);
  const monthFolderId = await ensureFolder(accessToken, month, yearFolderId);

  return {
    rootId,
    propertyId: propertyFolderId,
    billsId: billsFolderId,
    typeId: typeFolderId,
    yearId: yearFolderId,
    monthId: monthFolderId,
  };
}
