# Mobile Test Build — Issues Triage Plan (No Fixes Yet)

## Purpose

This document organizes tester feedback into an implementation-ready plan **without starting fixes yet**.

It does four things:
1. Normalize the raw issue list.
2. Merge duplicates and split overloaded items.
3. Group issues into logical work packages that can be implemented together.
4. Separate true bugs from improvement recommendations.

---

## Scope Notes

- Primary execution target for now: **mobile app (`rihla-app`)**.
- Some issues require **backend support** (and a few should later be mirrored in provider/admin panels).
- Improvements section at the end is treated as **recommendations**, not bugs.
- Numbering from tester list skips some numbers (e.g., no #2, #16, #17), preserved as-is for traceability.

---

## A) Normalization: Merge / Split Decisions

## A.1 Merge (same underlying problem)

### M1 — Arabic translation quality and policy wording
- Merge: **#3, #32, #37**
- Why: all are poor/unclear Arabic localization, especially refund/cancellation language and domain wording.

### M2 — RTL alignment on auth and trip list
- Merge: **#4 (partially), #31**
- Why: both are RTL alignment defects on Arabic UI.
- Keep split detail for #4 price alignment vs greeting alignment (different components).

### M3 — Booking required fields validation baseline
- Merge: **#5, #26**
- Why: both ask for default field-type validations even when provider does not configure custom validations.

### M4 — Validation UX flow for booking forms
- Merge: **#6, #7, #11**
- Why: all are one UX pipeline issue:
  - client-side validation before submit,
  - validate in the correct step before payment,
  - show per-field inline errors (not generic popup).

### M5 — “Already booked” visibility
- Merge: **#21** with improvement note **(Impr. #6)**
- Why: same product gap; improvement note proposes possible implementation option.

### M6 — Number localization inconsistency
- Merge: **#28, #29 (number part), #34 (date format policy overlap)**
- Why: all require coherent number/date formatting strategy; #29 also includes non-number localization items kept separate.

### M7 — Popup-heavy feedback quality
- Merge: **#33, #39**
- Why: #39 is broad audit request; #33 is concrete symptom.

### M8 — Profile state and edit sync inconsistency
- Merge: **#9, #18**
- Why: likely one shared state-sync/cache invalidation issue across profile and personal-information views.

---

## A.2 Split (one point contains multiple tasks)

### S1 — #1 payment callback outcome for package trips
Split into:
1. Post-payment state mapping (paid + pending provider confirmation).
2. Success screen copy/UI variant for packaged trips.
3. Ensure consistency with guided trip success flow.

### S2 — #27 payment form quality
Split into:
1. Input format constraints (MM/YY as 2-digit).
2. Client-side validation (card number basics, month/year validity, CVV length by card type if possible).
3. Better error message mapping (replace “Data Validation failed” generic popup).
4. Optional card brand detection (Visa/Mastercard) if feasible in current SDK flow.

### S3 — #20 bottom sheet notch affordance
Split into:
1. Gesture behavior standardization (drag-to-dismiss when handle/notch is shown).
2. Component inventory (filters, payment sheet, pickers).
3. Consistent close affordances and accessibility.

### S4 — #39 popup audit
Split into:
1. Inventory every popup trigger in app.
2. Classify each popup: keep / replace / redesign.
3. Replace non-critical alerts with inline/toast/sheet feedback patterns.

### S5 — #15 password strength
Split into:
1. Backend password policy enforcement (global, non-mobile-specific).
2. Mobile real-time strength hints + rules display.
3. Later parity for provider/admin panels.

---

## B) Grouped Work Packages (Execution Units)

## WP1 — Booking lifecycle correctness (High Priority)
Issues: **#1, #10, #21, #23, #24**

Includes:
- Correct post-payment state for package trips (paid but pending provider confirmation).
- Allow cancellation during 15-minute unpaid/pending-payment window.
- Show “already booked” early in trip detail.
- Prevent participant count from exceeding remaining seats.
- Enforce all-or-nothing participant booking on server (no partial fallback booking).

Likely dependencies:
- Backend booking state machine / availability checks.
- Mobile booking/trip-detail state refresh.

---

## WP2 — Booking form validation end-to-end UX (High Priority)
Issues: **M3 + M4 + #29 (gender localization part)** = **#5, #6, #7, #11, #26, #29(part)**

Includes:
- Baseline default validations by field type (email/phone/DOB/etc.).
- Client-side validation mirror for immediate feedback.
- Validate at the correct step before payment handoff.
- Per-field inline errors near fields.
- Ensure localized labels/values in booking info (e.g., gender Male/ذكر).

Likely dependencies:
- Existing backend validation config system.
- Mobile form renderer and field-component validation hooks.

---

## WP3 — Localization, RTL, and formatting consistency (High Priority)
Issues: **#3, #4, #28, #29, #30, #31, #32, #34, #37**

Includes:
- Arabic copy rewrite (semantic localization, not literal).
- RTL alignment fixes (greeting/create-account alignment, Arabic price placement in list).
- App name localization on login.
- Decide and enforce a single numeric strategy:
  - Preferred by tester: Arabic numerals in Arabic locale except payment card fields.
  - Acceptable fallback: English numerals everywhere for now (explicitly approved by tester).
- Date format normalization policy (`yyyy/mm/dd` requested).
- Refund policy phrasing clarity (explicitly mention **registration deadline**).

Likely dependencies:
- `i18n` dictionary cleanup and UI component formatting utilities.

---

## WP4 — Filters UX/data quality bundle (Medium Priority)
Issues: **#12, #13, #14, #19, #20**

Includes:
- Remove non-existent destinations from filters.
- Replace manual date text entry with date picker.
- Fix light-mode visual styling that looks disabled.
- Reset un-applied filter draft state when sheet closes.
- Implement/standardize drag-to-dismiss behavior if notch/handle is shown.

Likely dependencies:
- Trips data source quality for destinations.
- Shared bottom-sheet behavior.

---

## WP5 — Profile consistency and state synchronization (Medium Priority)
Issues: **#9, #18**

Includes:
- Fix empty/never-updating profile counters (trips/saved).
- Unify source-of-truth between profile page and personal-information tab.
- Prevent false dirty-state indicators and contradictory save/cancel outcomes.

Likely dependencies:
- React Query/Zustand cache invalidation and optimistic update handling.

---

## WP6 — Payment form UX polish (Medium Priority)
Issues: **#27**

Includes:
- MM/YY strict input format.
- Client-side validations before gateway submission.
- Better error surfaces for invalid payment data.
- Optional card-brand recognition.

Likely dependencies:
- Moyasar SDK/form constraints and backend error code mapping.

---

## WP7 — Content clarity improvements in trip detail (Low-Medium Priority)
Issues: **#8, #35, #36**

Includes:
- Rename “Choose a tier” label to non-action-confusing wording (e.g., “Tiers”).
- Expand trip type hint text for package vs guided clarity.
- Show registration deadline in trip detail.

---

## WP8 — Feedback UX standardization (Medium Priority)
Issues: **#33, #39**

Includes:
- Audit all popup-producing actions.
- Replace weak generic popups with better reusable feedback components.
- Improve cancellation/refund messaging (timeline expectations like 3–7 days).

---

## WP9 — Focused investigations / likely quick wins
Issues: **#22, #25, #38**

### #22 Saved-trips spam error
- Investigate root cause (rate limiting vs race condition vs duplicate request handling).
- Decide if behavior is acceptable or masking a bug.

### #25 Mobile autofill not appearing
- Investigate input `textContentType` / `autoComplete` / secure text settings and platform support.

### #38 OTP email layout on phones
- Reduce OTP text size/spacing in emails to avoid two-line wrap.

---

## C) Backend / Cross-Platform Flags (Important)

These are not mobile-only even if mobile is first target:

1. **Password strength (#15)**
   - Must be backend-enforced policy.
   - Mobile can add real-time hints now; provider/admin should adopt same UX later.

2. **Booking integrity (#23, #24, parts of #1/#10/#21)**
   - Requires backend guarantees and atomic checks.

3. **Validation baseline (#5/#26)**
   - Default server validations must exist regardless of provider config.
   - Mobile mirrors these for UX, but backend remains source of truth.

4. **Destination filter quality (#12)**
   - May require backend query/data fixes, not only frontend filtering.

---

## D) Recommended Implementation Order

1. **WP1** Booking lifecycle correctness
2. **WP2** Booking form validation UX pipeline
3. **WP3** Localization/RTL/format consistency
4. **WP4** Filters UX/data quality
5. **WP5** Profile state sync
6. **WP6** Payment form UX polish
7. **WP8** Feedback UX standardization
8. **WP7** Trip detail copy/clarity
9. **WP9** Investigations/quick wins

Reasoning:
- Start with revenue and booking correctness.
- Then eliminate frustrating validation/payment-step regressions.
- Then tackle high-visibility language/RTL consistency.

---

## E) Suggested Ticket Breakdown (for next execution phase)

Create one implementation ticket per work package:
- TKT-WP1 Booking lifecycle correctness
- TKT-WP2 Booking validation UX pipeline
- TKT-WP3 Localization + RTL iteration
- TKT-WP4 Filters UX/data cleanup
- TKT-WP5 Profile state synchronization
- TKT-WP6 Payment form validation/polish
- TKT-WP7 Trip detail content clarity
- TKT-WP8 Popup/feedback redesign system
- TKT-WP9 Investigation bundle (#22/#25/#38)

Each ticket should include explicit acceptance criteria and regression checklist.

---

## F) Tester Improvements (Recommendations, Not Bugs)

From tester improvement notes:

1. Embedded in-app payment browser/webview evaluation (Moyasar capability check).
2. Better refund-policy reveal UX (show contextually at cancel action).
3. Theme/language toggles instead of plain text taps.
4. Location-based trip defaults (domestic trips by user location).
5. Push notifications for trip status/updates.
6. Future enhancement: pre-detect booked trips in listing/query layer (same idea as #21).

These should be tracked separately from bug-fix sprint scope.

---

## G) Definition of Done for “start fixing all issues” phase

Before implementation starts, confirm:
- Final decision on numeric localization strategy (Arabic vs always-English fallback). remove numbers localization
- Final Arabic copy tone/style approved for key domains (refund/trip types/policies). decide yourself
- Which WP items require backend changes in same sprint vs staged rollout. all changes should be done now
- UX pattern decision for global feedback component replacing generic popups. decide yourself

Once confirmed, this document can be used as the execution reference.



You created this document yourself as an execution reference for the folloiwng prombt:
I've released a test version of the mobile app to be tested by testers and got back with the following list of issues that need fixing.
 i don't want you to start working on fixing the issues just yet. i want you to go over the issues create a document for yourself where you reason throught the issues and list the issues and group them by which issues can be worked on together as part of a single task and which issues points are actually one point and shoudl be merged together and which should be split and such. the goal is to come up with a document that i can point you to it for you to start working on solving all the issues. at the edn you'll see an improvements section, that section is about recommendations not issues so things that would be great to have but we don't have yet. 

Tester's bugs:

1- after paying for a packaged trip it takes you back to the app with a screen that tells you to pay, unlike guided trips where it's the correct confirmation screen that basically says you're confirmed and paid. my guess is that this happens becsaue package trips aren't confirmed right away. fix it so that the page after payment finishes shows that the user paid and just needs to wait for provider confirmation
3- Arabic translation is bad specially for refund policy the policy.
4- minor RTL issues. in trip list view the price in Arabic should be on the right not left liek English. in the login page the greeting should be on the right in Arabic.
5- trip booking fields are not validated, users submits false phone numbers and emails and DOB that is in the future and such. maybe this happens if the fields aren't configured by provider? it shouldn't happen as even if the fields aren't configured it should have basic validations. for DOB make sure it's not in the future, for phone number, do validation per country code. for email make sure it's a valid email and stuff like that for the rest of the fields
6- booking fields shouldn't just have backend validations it should also duplicate as much as it can to the client side (mobile) as currently for most validation the user wait's to submit the booking request to be notifierd with a validation error which is bad UX. we can copy simple stuff like email validation it's not hard.
7- trip booking fields should be validated in the same step. so a users fills the fields then presses confirm that's when we send data to the server (if they pass client side validations) to validate all the data. currently (for some fields) the users confirms and goes to the payment then presses pay then all the data is sent to the server, if it's invalid the user will have to go back to the filling the fields step which is bad UX
8- for package trips detail view, change the label above packages section from choose a tier to just Tiers or something as users are getting confused thinking they have to click a tier in that page.
9- in the profile data like trips and saved are not being updated they're always empty.
10- when users haven't paid yet and are waiting for the 15 minute payment window they should be able to cancel
11- fields error should appear per field maybe above each fields. currently the app displayes a pop up that shows errosr which isn't UX friendly
12- trip filters shows destinations that are non-existant
13- trip filter date field is manual typing not date picker it should be date picker
14- trip filters manual fields color gives the illusion that the fields are disabled in light mode
15- add password strength logic, currently users can add whatever password even very week ones. this should be validated in the backend and should also have mobile logic so users can know what they're missing in they're password while they're typing it and users should know password rules.
18- weird logic inconcestincy between changing the name in the profile directly and changing it in the personal information tab. changing it in the profile directly works right away, i just change it then 2 buttons appear save and cancel and i press save to save. but in the personal information tap first of all as soon as i enter it it says save information even tho nothing changed second of all if i change the name then hit save changes the save changes button says Done for a few seconds then goes back to save changes, if i go back to the profile page the name field will have to save and cancel button appear even tho i changed the name insdei the personal information tab, what's even more wierd is if i press cancel the change that i did inside the personal information tab is commited but if i press tab then the older name will be saved again. i'm guessing inside personal information the name changes then we go back to profile and the app notices a difference between fetched data and cached data and thinks it's a change or something like that i don't know
19- for the trip filters in the trip list view. when someone chooses a filter then presses the X button without applying it the filter doesn't apply which is correct, but when the user opens the filter tab again they will find the filters saved which is not a good UX. filters that aren't applied should be reset on filters close so users know they forgot to hit apply
20- small UI opnionated issue. the filter and the payment UI as well they both have that upper section that has a sort of notch at the top. from a users's perspective they think the notch indicates that they can hold put their finger on that upper section and scroll down to close that UI either the filter or the payment. but currently they can anly close it by tabbing outside the UI element or pressing the x button in case of filter. this notch ui element also ex ists for nationality picker when booking trips and for DOB UI and gender UI and maybe more i don't know. basically the ui elelemnt appears from down to top and has a notch so users think they can scroll it down from the notch section to close down the element. if you can do this it's great if you don't understand this then tell me.
21- trip doesn't show that i already have it booked until i submit a new booking request it will reject it which is too far down the line and bad UX. I should know as soon as i press on the trip that this trip is booked for me. maybe this is a taksing task from a query perspective? i think maybe we can compare trip id with active bookings id when the user visits the trip detail view and if this trip id matches one of the active booking ids then we show the this trip is booked badge or something? what other ways do you have for this?
22- spamming save button on trips gives error Could not update saved trips. Please try again. i actually don't have an issue with this as users shouldn't be spamming but i just want you to investigate if this error is due to limit rating we set or what? maybe this behavior is good but is caused by an underlying bug.
23- trips show the number of spots left per trip. the issue is that when buying/booking a trip, users can add as many participants as they want. we should limit that participants number to the seats left instead.
24- i don't know if we have this or not. since we don't have a locking mechanism for users when they are filling required fields for partiicapnts, a user can fill a number of participant but then the trip might have been booked so that that number can't be met. in that case when the request is sent to the backend we should deny the whole trip booking with an appropriate error. we shouldn't book the trip for the number remaining at all, maybe they don't want the trip unless they can book full participants. check if this is what happens now, if not then implememnt it
25- why is my phone not saving or recommending stuff when i fill fields for the app? usually the phone can prombt me to save user credentials or card payment details and will also prombt me to fill them automatically for me.
26- required fields validations are missing a lot of validations. check every field. even if provider doesn't configure fields validations there are standard validations like email should be valid email and DOB shouldn't be in the future and such
27- for the payment UI. users would want to match the information they see on the card. for month in payment cards they show as 2 numbers such as 02 for 2 or 09 for 9 or 12 for 12. and for year as well they show as 2 numbers such as 28 for 2028 or 35 for 2035. the payment UI should match this forcing users and limiting them to 2 number. also, when a user enters wrong payment info like wrong card number a pop up error of Data Validation failed shows up, the error message isn't good, and theyr should be client side validations for payment fields that can be usually validated, i don't know if card numbers usually have addiotnal client side validations but i know in other app when ai type thet card number it shows me if the card i'm typing is visa or mastercard and such which means aother app are aware of card number atleast so we cna have validations before sending the request.
28- Number localization is inconcistant. some numbers are Arabic and some number are English. examples. trip card in the list trips, the date has Arabic numbers but the spots left and trip price are English numbers. all numbers when the language is Arabic should be Arabic numbers. except for payment card number liek date or card number they should be in English even when Arabic becsaue even Arabic cards have English numbers. but other than that, trip information or required fields or add number of participants or number of booking either in profile or booking page or numbers in the profile such as rating or saved trip updates and such all should be Arabic number when language is Arabic. if this is a hard task and you're not sure we can localize all number then just have all the numbers be in English with no localization, this is an easier task as currently localized numbers are a few i think it's just date on trip list. also, i see that pouplar apps like booking.com don't have localize number the numbers are English even when language is Arabic so maybe that's the norm I'm very fine with that for now go with it if task is hard
29- trip booking information page has inconcesitincies in localization. some numbers are localized and some aren't, this goes back to number localization point but also when language is Arabic i'm seeing gender as male not ذكر see if other localization issues exists
30- in the login screen, app name is not localized
31- in the login screen the greeting section is on the left in Arabic when it should be on the right. save for register screen the create account text seciont should be on the right in Arabic.
32- users are complaining from the very poor Arabic translation. all we have is leteral translations from English that don't make sense, mostly for the refund/cancellation plolicies and the trip type. for example you translation cool off period to فترة الهدوء which doesn't make sense at all in Arabic. you don't have to translate word for word. instead translate i na way that is appropriate and understandable for the other lagnauge. do a localization iteration nand check current translation nand make sure they're good
33- app feedback is poor at times. it shows very bad UI popups. for example when cancelling a trip it shows a popup saying that trip is cancelled and refund was made and the percentage. fir of all it should be goo UI feedback and animation not just a square popup you can even make it a resuable feddback ui but at least make it good. also, we shouldn't just tell the user they're refunded we should say something like refund will be issued from 3 to 7 days or something.
34- dates should be yyyy/mm/dd not yyyy/dd/mm 
35- more detailed explanation for the trip type hint. add to the current text for tourism package something like "This is a trip package. provider will only provide you with the reservations/tickets for your trip but will not manage your trip, you'll attend the different trip activities by yourself" and for the guided one maybe add "provider will both provide tickets/reservations if included and will meet you at the meeting point to manage your trip and activities" or something like that you know users need more explanation
36- show registration deadline in trip detail
37- wording for refund policy is confusing. it says cancel more than 72h before deadline and you get a 100% refund, what is the deadline? is it registeration deadline or trip start deadlione or what? it doesn't say. ofcourse we know that it's registration deadline.
38- opening otp email on my phone screen make the otp 2 rows meaning otp numbers might be just too big. make them a little bit smaller
39- i want you to search the whole mobile app project looking for actions that produce po-up windows. then understand the conext of that action and try to remove the popup and add better UI if possible. only leave popup where it actually makes sense

NOTES: 
1- please make sure any change you make that you consider it's localization needs. also, for Arabic, please don't use that bad AI literal translation, I'm sure you know better Arabic than that
2- please note down any issues that aren't mobile app specific, for example the missing strong password strength is also a provider and admin panel issues that we'll need to do for all but we'll currently do it for the app only from a frontend perspective (we'll have testing session for provider and admin panels in the future)






Tester's improvement notes:
1- See if payment can be with an embedded browser. when users were directed to a webpage using they're mobile browser they felt like it's a forgeit experience as usually payment gateways open an embedded webpage inside the app. check our payment gateway (moyasar) allows for that.
2- Better UI for refund policies. for example we don't need a big prombt for the usre in the my booking page to show him refund policy we can show it to him when they press cancel instead.
3- make toggles for theme and language changes instead of just pressing the text
4- add a location service. we can get users location so that when user choses domestic trip we can right away show trips in the user country instead of the user having to pick a city
5- push notifications for trip status changes or trip updates
6- trip doesn't show that i already have it booked until i fill in all the fields and go to pay. this is ok for now as adding the is trip booked by user to the search is taksing but it can be a future improvement. or when a trip is opened we can retrive user currently active bookings and see if this trip is one of them, this way the query is way less taksing


