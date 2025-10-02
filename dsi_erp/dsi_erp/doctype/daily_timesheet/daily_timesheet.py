# Copyright (c) 2025, Siva and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class DailyTimesheet(Document):
	pass


def create_timesheets(doc, method):
	for row in doc.timesheet:
		ts = frappe.new_doc("Timesheet")
		ts.employee = row.employee
		ts.append("time_logs", {
			"activity_type": row.activity_type,
			"from_time": f"{doc.date} 08:00:00",
			"hours": row.hours or doc.default_hours,
			"project": row.project or doc.project,
			"task": row.task
		})
		ts.insert(ignore_permissions=True)
		ts.submit()

