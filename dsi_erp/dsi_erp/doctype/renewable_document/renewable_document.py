# Copyright (c) 2025, Siva and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class RenewableDocument(Document):
	pass


def sync_renewable_documents_from_employee(employee_name):
	"""
	Sync renewable documents from employee child table to main Renewable Document doctype
	"""
	employee = frappe.get_doc("Employee", employee_name)
	
	# Get all existing renewable documents for this employee
	existing_docs = frappe.get_all("Renewable Document", 
		filters={"employee": employee_name}, 
		fields=["name", "document_name", "document_number"]
	)
	
	# Create a dictionary for quick lookup
	existing_docs_dict = {}
	for doc in existing_docs:
		key = f"{doc.document_name}_{doc.document_number}"
		existing_docs_dict[key] = doc.name
	
	# Track which documents are still in the child table
	active_doc_keys = set()
	
	# Process each child document
	if employee.custom_renewable_documents:
		for child_doc in employee.custom_renewable_documents:
			# Create a unique key based on document name and number
			doc_key = f"{child_doc.document_name}_{child_doc.document_number}"
			active_doc_keys.add(doc_key)
			
			if doc_key in existing_docs_dict:
				# Update existing document
				doc = frappe.get_doc("Renewable Document", existing_docs_dict[doc_key])
			else:
				# Create new document
				doc = frappe.get_doc({
					"doctype": "Renewable Document",
					"employee": employee_name
				})
			
			# Update fields from child table (excluding document field)
			doc.document_name = child_doc.document_name
			doc.document_number = child_doc.document_number
			doc.date_of_issue = child_doc.date_of_issue
			doc.valid_upto = child_doc.valid_upto
			doc.place_of_issue = child_doc.place_of_issue
			
			doc.save(ignore_permissions=True)
	
	# Delete documents that are no longer in the child table
	for doc_key, doc_name in existing_docs_dict.items():
		if doc_key not in active_doc_keys:
			frappe.delete_doc("Renewable Document", doc_name, ignore_permissions=True)
	
	frappe.db.commit()


def on_employee_update(doc, method):
	"""
	Hook to sync renewable documents when employee is updated
	"""
	if method == "on_update":
		sync_renewable_documents_from_employee(doc.name)
