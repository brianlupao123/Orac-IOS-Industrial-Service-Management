from pptx import Presentation
import copy
import xml.etree.ElementTree as ET

pptx_path = r'C:\Users\BRIAN LUPAO\Desktop\orac-ios\frontend\deliverables\final-documents\ORAC_IOS_FINAL_EXECUTIVE_PRESENTATION.pptx'
prs = Presentation(pptx_path)
slides = prs.slides

changes = []

# ---- FIX 1: Slide 26 — correct two wrong email addresses ----
# Wrong in deck:  technician@orac.co.zw  (real seed: tech@orac.co.zw)
#                 operations@orac.co.zw  (real seed: ops@orac.co.zw)
# Also missing: supervisor@orac.co.zw and client@orac.co.zw — add to speaker note
slide26 = slides[25]
for shape in slide26.shapes:
    if not shape.has_text_frame:
        continue
    for para in shape.text_frame.paragraphs:
        for run in para.runs:
            if 'technician@orac.co.zw' in run.text:
                run.text = run.text.replace('technician@orac.co.zw', 'tech@orac.co.zw')
                changes.append('Slide 26: technician@orac.co.zw -> tech@orac.co.zw')
            if 'operations@orac.co.zw' in run.text:
                run.text = run.text.replace('operations@orac.co.zw', 'ops@orac.co.zw')
                changes.append('Slide 26: operations@orac.co.zw -> ops@orac.co.zw')

# Add speaker note for missing credentials + backend warning
slide26_notes = slide26.notes_slide
notes_tf = slide26_notes.notes_text_frame
current_notes = notes_tf.text
if 'supervisor@orac.co.zw' not in current_notes:
    para = notes_tf.add_paragraph()
    run = para.add_run()
    run.text = (
        'CORRECTIONS REQUIRED BEFORE PRESENTING: '
        '(1) Two role credentials missing from this slide — add supervisor@orac.co.zw and client@orac.co.zw to the bullet list. '
        '(2) Backend service may be suspended on Render free tier — resume/redeploy before the demo. '
        '(3) The two wrong emails above (technician@ and operations@) have been corrected to tech@ and ops@.'
    )
    changes.append('Slide 26 speaker note: added missing credentials warning and backend suspension note')

# ---- FIX 2: Slide 14 — fix the 8/8 PASS claim (Management was PASS_WITH_CONSOLE_ERRORS) ----
slide14 = slides[13]
for shape in slide14.shapes:
    if not shape.has_text_frame:
        continue
    for para in shape.text_frame.paragraphs:
        for run in para.runs:
            if '8/8 roles PASS' in run.text:
                run.text = run.text.replace('8/8 roles PASS', '7/8 roles PASS (1 PASS_WITH_CONSOLE_ERRORS — see slide 15)')
                changes.append('Slide 14: 8/8 roles PASS -> 7/8 roles PASS (1 PASS_WITH_CONSOLE_ERRORS)')
            # Also fix the headline KPI if present
            if 'Live UAT' in run.text and '8/8' in run.text:
                run.text = run.text.replace('8/8', '7/8')
                changes.append('Slide 14 UAT headline: 8/8 -> 7/8')

# ---- FIX 3: Slides 21-22 — add speaker note clarifying assistant-access is unverified for Supervisor/Technician ----
for slide_idx, role_name in [(20, 'Supervisor'), (21, 'Technician')]:
    slide = slides[slide_idx]
    notes_slide = slide.notes_slide
    notes_tf = notes_slide.notes_text_frame
    note_text = notes_tf.text
    if 'unverified' not in note_text.lower():
        para = notes_tf.add_paragraph()
        run = para.add_run()
        run.text = (
            f'UNVERIFIED CLAIM: The slide body states "The assistant uses the same role-scoped dashboard context '
            f'shown to this user." This has NOT been independently confirmed for {role_name} in the live deployment. '
            f'Section 10.1 of the System Documentation records an unresolved contradiction between governance material '
            f'(which phases out Supervisor/Technician assistant access) and UAT evidence (which shows wider access). '
            f'Do not present this slide as confirmed until that contradiction is resolved.'
        )
        changes.append(f'Slide {slide_idx + 1} ({role_name}) speaker note: added unverified-assistant-access warning')

prs.save(pptx_path)
print(f'SAVED. {len(changes)} changes applied:')
for c in changes:
    print(f'  - {c}')
