# English demonstration script

Updated 2026-10-02. Target: 2 minutes 45 seconds. This is a recording plan, not an existing video. Rehearse timing and show actual UI behavior.

## Before recording

Use the independent `/demo` workspace throughout this recording. Start a separate standard scenario through **Start another scenario → Confirm new scenario**. Keep generated-photo labels visible. Rehearse the actions with the explicit action menu; record the actual page and avoid showing unrelated tabs or credentials. The private Supabase case is not needed.

## 0:00–0:20 — The problem and the boundary

Show the guide page.

“This is RentalEase Move-Out Companion, a simulated web experience for the Alexa+ track. A deposit dispute often starts with one question: was that damage already there? The companion helps people find the record, discuss a deduction, and confirm a decision. It is not connected to the Alexa+ runtime.”

## 0:20–0:55 — Evidence you can inspect

Open the independent demo. Select the wall item, ask “Show evidence for the first deduction,” then show cleaning and its images.

“This independent demo runs without private service credentials. These are synthetic records with labelled generated photographs. Each deduction has its own sources. I can compare move-in and move-out images and follow a file reference. The assistant quotes recorded text; it does not decide what a photo proves.”

## 0:55–1:55 — Both sides of the conversation

As tenant, prepare a wall dispute and cancel once; prepare and confirm it. Dispute cleaning separately. Switch to landlord and reply to cleaning; switch to tenant and reject that reply. As landlord, propose MYR 20; as tenant, accept it. Preview and confirm each decision. A longer rejected-offer branch is optional if the rehearsal fits the time limit.

“Preparing a dispute does not save it. I review the draft and explicitly confirm. The landlord can reply or propose a new amount, and the tenant can reject or accept the available response. A proposed amount stays pending until accepted. Role switching here simulates both people; the separate records workspace uses authenticated accounts.”

## 1:55–2:25 — Three separate outcomes

As tenant, accept the MYR 25 key deduction. As landlord, withdraw the wall deduction. Show 3/3 resolved, the refund and shared history. Refresh and show the saved result again.

“The wall deduction is withdrawn. Cleaning is accepted at twenty ringgit, and the key at twenty-five. Each item has its own outcome. Final deductions total forty-five ringgit, with a recorded refund of one thousand seven hundred and fifty-five ringgit. Refresh keeps the confirmed history.”

## 2:25–2:45 — A reviewable outcome

Show the source references and simulation disclosure. If time allows, briefly open the scenario chooser to show missing/conflicting evidence options without starting another case.

“An agreed settlement is not a bank transfer. This builds on my existing RentalEase FYP; hackathon additions include source-linked conversation, confirmation, private evidence and independent deduction resolution. Wider evaluation and formal Alexa+ integration, subject to access, come next.”

The downloadable summary and private MCP tools belong to `/records`, not `/demo`. Show them only in a separately labelled optional segment if the final recording plan includes that configured workspace.
