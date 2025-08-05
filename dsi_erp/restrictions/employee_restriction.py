import frappe

def restrict_top_level_employee_doc(doc, method=None):
    user = frappe.session.user

    user_roles = frappe.get_roles(user)
    if "CFO" in user_roles:
        return  # CFO can access all

    # Optional: Block even Administrator
    if user == "Administrator":
        frappe.throw("Access Denied: Admin not allowed to view Top Management data.")

    # Case 1: The document itself is Employee
    if doc.doctype == "Employee" and doc.get("custom_top_level_managment"):
        frappe.throw("Access Denied: You are not authorized to access this Top Management employee.")

    # Case 2: The document is linked to Employee
    employee_field = get_employee_field(doc)
    if not employee_field:
        return

    employee_id = getattr(doc, employee_field, None)
    if not employee_id:
        return

    is_tlm = frappe.db.get_value("Employee", employee_id, "custom_top_level_managment")
    if is_tlm and doc.docstatus in [1, 2]:
        frappe.throw("Access Denied: You are not authorized to view this Top Management record.")

def get_employee_field(doc):
    for field in doc.meta.fields:
        if field.fieldtype == "Link" and field.options == "Employee":
            return field.fieldname
    return None