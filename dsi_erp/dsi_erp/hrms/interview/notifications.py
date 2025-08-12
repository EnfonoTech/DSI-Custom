import frappe
from frappe.core.doctype.communication.email import make


@frappe.whitelist()
def send_interview_notifications(interviews):
    if interviews:
        interview = frappe.get_doc("Interview", interviews)

        applicant_email = None
        interviewer_emails = []

        # Get Job Applicant Email
        if interview.job_applicant:
            applicant_email = frappe.db.get_value(
                "Job Applicant",
                interview.job_applicant,
                "email_id"
            )

        # Get Interviewer Emails
        for interviewer in interview.interview_details:
            if interviewer.interviewer:
                user_email = frappe.db.get_value(
                    "User",
                    interviewer.interviewer,
                    "email"
                )
                if user_email:
                    interviewer_emails.append(user_email)

        # Send single email with applicant in To and interviewers in CC
        if applicant_email:
            send_email(
                recipient=applicant_email,
                cc=interviewer_emails,
                subject=f"Interview Scheduled: {interview.interview_round} at {interview.from_time}",
                message=f"""<p>Dear Candidate,</p>
                    <p>Your interview for the role of <strong>{interview.designation or ''}</strong> is scheduled on <strong>{frappe.format(interview.scheduled_on, dict(fieldtype="Date"))}</strong> from {interview.from_time} to {interview.to_time}.</p>
                    <br>
                    <p>Regards,</p>
                    <p>HR Team</p>"""
            )

        # Return for JS display
        return {
            "applicant_email": applicant_email,
            "interviewer_emails": interviewer_emails
        }


def send_email(recipient, subject, message, cc=None):
    make(
        recipients=recipient,
        cc=", ".join(cc or []),  # convert list to string
        subject=subject,
        content=message,
        content_type='html',  # ensure HTML email
        communication_medium='Email',
        send_email=True
    )
