import frappe


def validate(doc, method):
    """
    Handle item code generation in validate event for both new and existing items
    """
    if doc.item_group:
        try:
            prefix = build_prefix(doc.item_group)
            if prefix:
                expected_prefix = f"{prefix}-"
                
                # For new items, generate code (make sure it doesn't exist)
                if doc.is_new() or not doc.item_code:
                    doc.item_code = get_next_available_item_code(prefix)
                    return
                
                # For existing items, check if item group changed and code needs update
                if not doc.item_code.startswith(expected_prefix):
                    new_item_code = get_next_available_item_code(prefix, doc.name)
                    
                    # Store the rename info in doc itself for reliability
                    doc._rename_info = {
                        "old_code": doc.item_code,
                        "new_code": new_item_code
                    }
                    
                    # Set the new item code
                    doc.item_code = new_item_code
                    
        except Exception as e:
            frappe.log_error(f"Error in item validation: {str(e)}", "Item Validation Error")


def get_next_available_item_code(prefix, exclude_item_name=None):
    """
    Get the next available item code that definitely doesn't exist in the system
    """
    if not prefix:
        prefix = "ITEM"
    
    # Get all existing item codes with this prefix
    filters = [["item_code", "like", f"{prefix}-%"]]
    existing_items = frappe.get_all(
        "Item",
        filters=filters,
        fields=["name", "item_code"],
        order_by="item_code"
    )
    
    # If excluding an item, remove it from the list
    if exclude_item_name:
        existing_items = [item for item in existing_items if item["name"] != exclude_item_name]
    
    # Extract all numbers from existing item codes
    existing_numbers = []
    for item in existing_items:
        item_code = item["item_code"]
        if item_code and item_code.startswith(f"{prefix}-"):
            try:
                number_str = item_code.replace(f"{prefix}-", "")
                number = int(number_str)
                existing_numbers.append(number)
            except ValueError:
                continue
    
    # Find the first available number starting from 1
    existing_numbers.sort()
    next_number = 1
    for num in existing_numbers:
        if num == next_number:
            next_number += 1
        elif num > next_number:
            break
    
    # Return the formatted code
    return f"{prefix}-{str(next_number).zfill(4)}"


def on_update(doc, method):
    """
    Handle renaming after the document is updated
    """
    if hasattr(doc, '_rename_info') and doc._rename_info:
        rename_data = doc._rename_info
        
        # Double-check that the new code doesn't exist
        if (frappe.db.exists("Item", rename_data["new_code"]) and 
            rename_data["new_code"] != rename_data["old_code"]):
            # If it exists, find the next available code
            rename_data["new_code"] = get_next_available_item_code(
                rename_data["new_code"].split("-")[0], 
                doc.name
            )
            doc.item_code = rename_data["new_code"]
        
        try:
            # Check if the old code still exists and new code is different
            if (frappe.db.exists("Item", rename_data["old_code"]) and 
                rename_data["old_code"] != rename_data["new_code"]):
                
                # Perform the actual rename
                frappe.rename_doc(
                    "Item",
                    rename_data["old_code"],
                    rename_data["new_code"],
                    force=True,
                    merge=False,
                    show_alert=False
                )
                
                frappe.msgprint(f"Item successfully renamed from {rename_data['old_code']} to {rename_data['new_code']}")
                
            else:
                # Item was already renamed or codes are the same
                frappe.msgprint(f"Item code is now: {rename_data['new_code']}")
                
        except frappe.LinkExistsError:
            frappe.throw(f"Cannot rename item {rename_data['old_code']} because it has existing transactions or links.")
        except Exception as e:
            frappe.log_error(f"Error renaming item: {str(e)}", "Item Rename Error")
            frappe.throw(f"Failed to rename item: {str(e)}")


def build_prefix(item_group_name):
    """
    Build prefix from item group hierarchy
    """
    if not item_group_name:
        return ""
    
    try:
        item_group = frappe.get_doc("Item Group", item_group_name)
        current_code = (item_group.item_group_name or "").replace(" ", "")[:2].upper()
        
        if item_group.parent_item_group and item_group.parent_item_group != "All Item Groups":
            parent_code = build_prefix(item_group.parent_item_group)
            return parent_code + current_code
        else:
            return current_code
            
    except Exception as e:
        frappe.log_error(f"Error building prefix: {str(e)}", "Build Prefix Error")
        return ""


@frappe.whitelist()
def get_item_code_preview(item_group, current_item=None):
    """
    API method to preview item code for client-side display
    """
    if not item_group:
        return ""
    
    try:
        prefix = build_prefix(item_group)
        if prefix:
            # For preview, we don't exclude current item to show what would be generated
            code = get_next_available_item_code(prefix)
            return code
        return ""
    except Exception as e:
        frappe.throw(f"Error generating preview: {str(e)}")