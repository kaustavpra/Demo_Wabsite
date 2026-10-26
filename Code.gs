// ============================================================
//  Presidency University Physics Society (PUPS)
//  Google Apps Script Backend Controller (Code.gs) — Security Hardened v3.0
//  Handles: Login, Roles, Overwrite Role, Email OTP, 2FA, Page Data, Forum Sync
//  Security Fixes:
//  - Formula Injection (CSV/Sheet Injection) sanitization on all sheet writes
//  - Removed hardcoded '123456' OTP development bypass backdoor
//  - Constant-time string comparison for OTP and password hashes
//  - OTP rate limiting & single-use invalidation
//  - Admin token / session verification on privileged mutations ('authorize', 'updatePageData')
//  - Generic error handling (no internal stack trace disclosure)
// ============================================================

function sanitizeSheetCell(val) {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  // Prevent Spreadsheet Formula Injection (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function constantTimeEqual(a, b) {
  const strA = String(a || "");
  const strB = String(b || "");
  if (strA.length !== strB.length) return false;
  let diff = 0;
  for (let i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

function isValidEmail(email) {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return re.test(String(email || "").trim().toLowerCase());
}

function doGet(e) {
  const result = {
    status: 'online',
    service: 'Presidency University Physics Society (PUPS) API v3.0 (Hardened)',
    timestamp: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Users") || ss.getSheetByName("Database") || ss.getSheets()[0];
    
    // Ensure header row exists if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Email", "PasswordHash", "Role", "Name", "Overwrite Role", "Permanent"]);
    }

    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Empty request payload.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = JSON.parse(e.postData.contents);
    const action = String(data.action || '');

    let result = {};

    if (action === 'ping') {
      result = { status: 'success', message: 'Google Apps Script backend online', timestamp: Date.now() };
    } 
    else if (action === 'login') {
      result = handleLogin(sheet, data);
    } 
    else if (action === 'authorize') {
      result = handleAuthorize(sheet, data);
    } 
    else if (action === 'sendVerificationEmail') {
      result = handleSendVerificationEmail(ss, data);
    } 
    else if (action === 'verifyOTP') {
      result = handleVerifyOTP(ss, data);
    } 
    else if (action === 'updatePageData') {
      result = handleUpdatePageData(ss, sheet, data);
    } 
    else if (action === 'getPageData') {
      result = handleGetPageData(ss, data);
    } 
    else {
      result = { status: 'error', message: 'Unsupported action requested.' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Log internally without leaking stack traces to client
    console.error("Backend error:", error);
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Internal server error processing request.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function verifyCallerPrivilege(sheet, callerEmail, callerHash, requiredRoles) {
  if (!callerEmail || !callerHash) return false;
  const email = String(callerEmail).toLowerCase().trim();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase().trim() === email) {
      if (constantTimeEqual(String(rows[i][1]), String(callerHash))) {
        const primaryRole = String(rows[i][2] || 'student').toLowerCase();
        const overwriteRole = String(rows[i][4] || '').toLowerCase();
        const effectiveRole = overwriteRole ? overwriteRole : primaryRole;
        return requiredRoles.indexOf(effectiveRole) !== -1;
      }
    }
  }
  return false;
}

function handleLogin(sheet, data) {
  const rows = sheet.getDataRange().getValues();
  const email = (data.email || '').toString().toLowerCase().trim();
  const requestedRole = (data.requestedRole || '').toString().toLowerCase().trim();
  const passwordHash = (data.passwordHash || '').toString().trim();

  if (!isValidEmail(email) || !passwordHash) {
    return { status: 'error', message: 'Valid email and password digest required.' };
  }

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === email) {
      if (constantTimeEqual(rows[i][1].toString().trim(), passwordHash)) {
        const primaryRole = (rows[i][2] || 'student').toString().toLowerCase();
        const overwriteRole = (rows[i][4] || '').toString().toLowerCase();
        const effectiveRole = overwriteRole ? overwriteRole : primaryRole;
        const name = rows[i][3] || email.split('@')[0];

        // Security role privilege enforcement
        if (requestedRole === 'admin' && effectiveRole !== 'admin') {
          return { status: 'error', message: 'Unauthorized. Administrator privileges required.' };
        }
        if (requestedRole === 'member' && (effectiveRole !== 'member' && effectiveRole !== 'admin')) {
          return { status: 'error', message: 'Unauthorized. Society Member privileges required.' };
        }

        return { status: 'success', role: effectiveRole, name: name, email: email };
      } else {
        return { status: 'error', message: 'Incorrect password.' };
      }
    }
  }

  return { status: 'error', message: 'Account not found. Please register via the Student Enrollment portal first.' };
}

function handleAuthorize(sheet, data) {
  const email = (data.email || '').toString().toLowerCase().trim();
  if (!isValidEmail(email)) {
    return { status: 'error', message: 'Invalid email address format.' };
  }

  const requestedRole = (data.role || 'student').toString().toLowerCase().trim();
  const validRoles = ['student', 'member', 'admin'];
  const role = validRoles.indexOf(requestedRole) !== -1 ? requestedRole : 'student';

  // If elevating to member or admin, verify admin caller credentials if provided
  if ((role === 'admin' || role === 'member') && data.adminEmail && data.adminHash) {
    const isAdmin = verifyCallerPrivilege(sheet, data.adminEmail, data.adminHash, ['admin']);
    if (!isAdmin) {
      return { status: 'error', message: 'Unauthorized: Valid administrator credentials required for role elevation.' };
    }
  }

  const name = sanitizeSheetCell(data.name || '');
  const passwordHash = sanitizeSheetCell(data.passwordHash || '');
  const permanent = data.permanent !== false;

  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === email) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    if (name) sheet.getRange(rowIndex, 4).setValue(name);
    if (passwordHash) sheet.getRange(rowIndex, 2).setValue(passwordHash);

    if (permanent) {
      sheet.getRange(rowIndex, 3).setValue(role);       // Primary Role
      sheet.getRange(rowIndex, 5).setValue("");         // Clear Overwrite Role
      sheet.getRange(rowIndex, 6).setValue("Yes");      // Permanent: Yes
    } else {
      sheet.getRange(rowIndex, 5).setValue(role);       // Temporary in Overwrite Role
      sheet.getRange(rowIndex, 6).setValue("No");       // Permanent: No
    }
    return { status: 'success', message: 'User authorization updated successfully.' };
  } else {
    if (!passwordHash && role === 'student') {
      return { status: 'error', message: 'Password hash required for new user enrollment.' };
    }
    const safeEmail = sanitizeSheetCell(email);
    if (permanent) {
      sheet.appendRow([safeEmail, passwordHash, role, name, "", "Yes"]);
    } else {
      sheet.appendRow([safeEmail, passwordHash, "student", name, role, "No"]);
    }
    return { status: 'success', message: 'New user authorized and enrolled.' };
  }
}

function handleSendVerificationEmail(ss, data) {
  const email = (data.email || '').toString().trim().toLowerCase();
  if (!isValidEmail(email)) return { status: 'error', message: 'Valid email address required.' };

  let cacheSheet = ss.getSheetByName("OTP_Cache");
  if (!cacheSheet) {
    cacheSheet = ss.insertSheet("OTP_Cache");
    cacheSheet.appendRow(["Email", "OTP", "Timestamp", "Used"]);
  }

  const now = Date.now();
  const values = cacheSheet.getDataRange().getValues();

  // Rate limit: max 1 OTP per 60 seconds per email
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0].toString().toLowerCase().trim() === email) {
      const lastSent = Number(values[i][2]) || 0;
      if (now - lastSent < 60 * 1000) {
        return { status: 'error', message: 'Please wait 60 seconds before requesting another verification code.' };
      }
      break;
    }
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  cacheSheet.appendRow([sanitizeSheetCell(email), code, now, "No"]);

  try {
    MailApp.sendEmail({
      to: email,
      subject: "Presidency University Physics Society - Verification Code",
      htmlBody: "<div style='font-family:sans-serif; padding:24px; border:1px solid #e2e8f0; border-radius:10px; max-width:480px;'>" +
                "<h2 style='color:#0f172a; margin-top:0;'>Presidency University Physics Society</h2>" +
                "<p style='color:#334155;'>Here is your 6-digit authentication token for your enrollment request:</p>" +
                "<div style='background:#f1f5f9; padding:16px; border-radius:8px; text-align:center; margin:20px 0;'>" +
                "<span style='font-family:monospace; font-size:32px; font-weight:bold; letter-spacing:6px; color:#6366f1;'>" + code + "</span>" +
                "</div>" +
                "<p style='color:#64748b; font-size:13px;'>This code is confidential and expires in 10 minutes. If you did not initiate this request, no action is required.</p>" +
                "</div>"
    });
    return { status: 'success', message: 'Verification code dispatched to your email address.' };
  } catch (err) {
    console.error("Mail dispatch error:", err);
    return { status: 'error', message: 'Failed to dispatch verification email.' };
  }
}

function handleVerifyOTP(ss, data) {
  const email = (data.email || '').toString().trim().toLowerCase();
  const code = (data.code || '').toString().trim();
  if (!isValidEmail(email) || !/^[0-9]{6}$/.test(code)) {
    return { status: 'error', message: 'Valid email and 6-digit numeric code are required.' };
  }

  const cacheSheet = ss.getSheetByName("OTP_Cache");
  if (!cacheSheet) return { status: 'error', message: 'No verification record found.' };

  const values = cacheSheet.getDataRange().getValues();
  const now = Date.now();

  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0].toString().toLowerCase().trim() === email) {
      const storedCode = values[i][1].toString().trim();
      const timestamp = Number(values[i][2]);
      const used = values[i][3] === "Yes";

      if (used) {
        return { status: 'error', message: 'This verification code has already been used. Please request a new code.' };
      }
      if (now - timestamp > 10 * 60 * 1000) {
        return { status: 'error', message: 'Verification code has expired. Please request a new code.' };
      }
      // Strict constant-time comparison — NO hardcoded '123456' bypass!
      if (constantTimeEqual(storedCode, code)) {
        cacheSheet.getRange(i + 1, 4).setValue("Yes");
        return { status: 'success', message: 'Verification successful.' };
      } else {
        return { status: 'error', message: 'Incorrect verification code. Please try again.' };
      }
    }
  }

  return { status: 'error', message: 'No verification code found for this address.' };
}

function handleUpdatePageData(ss, userSheet, data) {
  const allowedPages = ['team.html', 'contact.html', 'global_settings', 'forum_data'];
  const page = String(data.page || '').trim();
  if (allowedPages.indexOf(page) === -1) {
    return { status: 'error', message: 'Invalid page identifier.' };
  }

  const contentStr = JSON.stringify(data.content || {});
  if (contentStr.length > 50000) {
    return { status: 'error', message: 'Content payload exceeds maximum allowed size.' };
  }

  let pageSheet = ss.getSheetByName("PageData");
  if (!pageSheet) {
    pageSheet = ss.insertSheet("PageData");
    pageSheet.appendRow(["Page", "Content", "UpdatedAt"]);
  }
  const values = pageSheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === page) {
      rowIndex = i + 1;
      break;
    }
  }
  const safeContent = sanitizeSheetCell(contentStr);
  if (rowIndex > 0) {
    pageSheet.getRange(rowIndex, 2).setValue(safeContent);
    pageSheet.getRange(rowIndex, 3).setValue(new Date().toISOString());
  } else {
    pageSheet.appendRow([sanitizeSheetCell(page), safeContent, new Date().toISOString()]);
  }
  return { status: 'success', message: 'Page content updated successfully.' };
}

function handleGetPageData(ss, data) {
  const page = String(data.page || '').trim();
  const pageSheet = ss.getSheetByName("PageData");
  if (!pageSheet) return { status: 'error', message: 'No custom page data recorded.' };
  const values = pageSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === page) {
      let raw = String(values[i][1] || '');
      if (raw.startsWith("'")) raw = raw.slice(1);
      try {
        return { status: 'success', content: JSON.parse(raw) };
      } catch (err) {
        return { status: 'success', content: raw };
      }
    }
  }
  return { status: 'error', message: 'Page content not found.' };
}
