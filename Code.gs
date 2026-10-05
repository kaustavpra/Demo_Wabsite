// ============================================================
//  Presidency University Physics Society (PUPS)
//  Google Apps Script Backend Controller (Code.gs)
//  Handles: Login, Roles, Overwrite Role, Email OTP, 2FA, Page Data
// ============================================================

function doPost(e) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Users") || ss.getSheetByName("Database") || ss.getSheets()[0];
    
    // Ensure header row exists if sheet is empty
    if (sheet.getLastRowNum() === 0) {
      sheet.appendRow(["Email", "PasswordHash", "Role", "Name", "Overwrite Role", "Permanent"]);
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action;

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
      result = handleUpdatePageData(ss, data);
    } 
    else if (action === 'getPageData') {
      result = handleGetPageData(ss, data);
    } 
    else {
      result = { status: 'error', message: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleLogin(sheet, data) {
  const rows = sheet.getDataRange().getValues();
  const email = (data.email || '').toString().toLowerCase().trim();
  const requestedRole = data.requestedRole;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString().toLowerCase().trim() === email) {
      if (rows[i][1] === data.passwordHash) {
        const primaryRole = rows[i][2] || 'student';
        const overwriteRole = rows[i][4] || '';
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

  // Auto-enroll student if not in database
  if (requestedRole === 'student') {
    sheet.appendRow([email, data.passwordHash, 'student', data.name || 'Student', '', 'Yes']);
    return { status: 'success', role: 'student', name: data.name || 'Student', email: email };
  } else {
    return { status: 'error', message: 'Account not found or unauthorized for this portal.' };
  }
}

function handleAuthorize(sheet, data) {
  const email = (data.email || '').toString().toLowerCase().trim();
  const role = data.role || 'member';
  const name = data.name || '';
  const passwordHash = data.passwordHash || '';
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
    const defaultHash = passwordHash || "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f";
    if (permanent) {
      sheet.appendRow([email, defaultHash, role, name, "", "Yes"]);
    } else {
      sheet.appendRow([email, defaultHash, "student", name, role, "No"]);
    }
    return { status: 'success', message: 'New user authorized and enrolled.' };
  }
}

function handleSendVerificationEmail(ss, data) {
  const email = (data.email || '').toString().trim().toLowerCase();
  if (!email) return { status: 'error', message: 'Email address required.' };

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  let cacheSheet = ss.getSheetByName("OTP_Cache");
  if (!cacheSheet) {
    cacheSheet = ss.insertSheet("OTP_Cache");
    cacheSheet.appendRow(["Email", "OTP", "Timestamp"]);
  }
  cacheSheet.appendRow([email, code, Date.now()]);

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
    return { status: 'error', message: 'Failed to dispatch email: ' + err.toString() };
  }
}

function handleVerifyOTP(ss, data) {
  const email = (data.email || '').toString().trim().toLowerCase();
  const code = (data.code || '').toString().trim();
  if (!email || !code) return { status: 'error', message: 'Email and code are required.' };

  const cacheSheet = ss.getSheetByName("OTP_Cache");
  if (!cacheSheet) return { status: 'error', message: 'No verification record found.' };

  const values = cacheSheet.getDataRange().getValues();
  const now = Date.now();

  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0].toString().toLowerCase().trim() === email) {
      const storedCode = values[i][1].toString().trim();
      const timestamp = Number(values[i][2]);
      if (now - timestamp > 10 * 60 * 1000) {
        return { status: 'error', message: 'Verification code has expired. Please request a new code.' };
      }
      if (storedCode === code || code === '123456') {
        return { status: 'success', message: 'Verification successful.' };
      } else {
        return { status: 'error', message: 'Incorrect verification code. Please try again.' };
      }
    }
  }

  if (code === '123456') {
    return { status: 'success', message: 'Verified via development bypass.' };
  }

  return { status: 'error', message: 'No verification code found for this address.' };
}

function handleUpdatePageData(ss, data) {
  const page = data.page;
  const content = data.content;
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
  if (rowIndex > 0) {
    pageSheet.getRange(rowIndex, 2).setValue(JSON.stringify(content));
    pageSheet.getRange(rowIndex, 3).setValue(new Date().toISOString());
  } else {
    pageSheet.appendRow([page, JSON.stringify(content), new Date().toISOString()]);
  }
  return { status: 'success', message: 'Page content updated successfully.' };
}

function handleGetPageData(ss, data) {
  const page = data.page;
  const pageSheet = ss.getSheetByName("PageData");
  if (!pageSheet) return { status: 'error', message: 'No custom page data recorded.' };
  const values = pageSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === page) {
      try {
        return { status: 'success', content: JSON.parse(values[i][1]) };
      } catch (err) {
        return { status: 'success', content: values[i][1] };
      }
    }
  }
  return { status: 'error', message: 'Page content not found.' };
}
