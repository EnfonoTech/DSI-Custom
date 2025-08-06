# your_custom_app/notifications.py
import frappe
from frappe.core.doctype.communication.email import make
from frappe.utils import get_url

@frappe.whitelist()
def send_interview_notifications(interviews):
    interviews = frappe.parse_json(interviews)
    for interview_id in interviews:
        interview = frappe.get_doc("Interview", interview_id)

        # Send to Job Applicant
        if interview.job_applicant:
            applicant_email = frappe.db.get_value("Job Applicant", interview.job_applicant, "email_id")
            if applicant_email:
                send_email(
                    recipient=applicant_email,
                    subject=f"Interview Scheduled: {interview.interview_round}",
                    message=f"Dear Candidate,\n\nYour interview for the role of {interview.designation} is scheduled on {interview.interview_date}.\n\nRegards,\nHR Team"
                )

        # Send to Interviewers
        for interviewer in interview.interview_details:
            if interviewer.interviewer:
                user_email = frappe.db.get_value("User", interviewer.interviewer, "email")
                if user_email:
                    send_email(
                        recipient=user_email,
                        subject=f"Interview Assigned: {interview.interview_round}",
                        message=f"Dear {interviewer.interviewer},\n\nYou have been assigned an interview for {interview.job_applicant} on {interview.interview_date}.\n\nRegards,\nHR Team"
                    )

def send_email(recipient, subject, message):
    frappe.sendmail(
        recipients=[recipient],
        subject=subject,
        message=message
    )
