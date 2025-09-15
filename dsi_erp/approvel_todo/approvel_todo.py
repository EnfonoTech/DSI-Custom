import frappe

def create_todo_for_approval(doc, method):
    if doc.status == "Open":
        if not frappe.db.exists("ToDo", {
            "reference_type": doc.reference_doctype,
            "reference_name": doc.reference_name,
            "owner": doc.user
        }):
            frappe.get_doc({
                "doctype": "ToDo",
                "description": f"Approval required for {doc.reference_doctype} {doc.reference_name}",
                "reference_type": doc.reference_doctype,
                "reference_name": doc.reference_name,
                "assigned_by": frappe.session.user,
                "owner": doc.user
            }).insert(ignore_permissions=True)
