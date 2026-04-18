# iOS Handoff Checklist (No-Mac Prep Complete)

Use this when handing the project to the Mac/Xcode owner for final iOS distribution work.

## 1) What Is Already Ready
- Web app builds clean:
  - `npm run check`
  - `npm run build`
- Capacitor config validated:
  - `npm run mobile:check`
- Core app flows are live-tested in web/PWA.

## 2) Required on Mac
- Install:
  - Xcode (latest stable)
  - CocoaPods
  - Node/npm
- Pull latest `main`.
- Run:
  - `npm install`
  - `npm run cap:sync`
  - `npm run cap:open:ios`

## 3) Xcode Tasks
- Confirm signing team/certificate/profile.
- Increment:
  - `MARKETING_VERSION`
  - `CURRENT_PROJECT_VERSION`
- Validate `Info.plist`:
  - display name
  - usage strings for any enabled native capabilities.
- Build and run on:
  - iPhone physical device
  - iPhone simulator

## 4) Release Validation
- Login/logout
- Password reset request + reset completion
- Schedule pages:
  - team schedule
  - my schedule
  - admin schedule (admin account)
- Profile updates + birthday request
- Toast and navigation behavior

## 5) Distribution
- Archive release build in Xcode.
- Upload to App Store Connect.
- Deploy to TestFlight first.
- Complete UAT checklist before App Store submission.

## 6) Notes
- If camera beta is not approved, keep:
  - `PUBLIC_CAMERA_BETA_ENABLED=false`
