# Presidency University Physics Society website

Vanilla HTML + CSS + JavaScript multi-page website.

## Public pages
- index.html — Home
- about.html — About
- events.html — Events
- colloquium.html — Colloquium
- team.html — Team
- contact.html — Contact
- login.html — role-based login

## Login roles
### Students
Open to anyone. Read-only access to the Interactive Lab, Math Formulas and Academic Forum pages. No content editing.

### Members
Authorized Society members can edit Events, Colloquia, Academic Statistics and Metrics. Personal information, authorization and security controls remain unavailable.

### Admin
Authorized administrators can manage users/roles, revoke access, edit security policy and review Login Status records.

## Important
This is a front-end prototype. localStorage/sessionStorage are used only for demonstration. Real authentication, authorization, password storage, IP/device auditing, session revocation and security enforcement should be implemented on a secure backend.

`webside.html` is retained only as a compatibility redirect to `index.html`, so accidentally opening the legacy filename will not send users to the login page.
