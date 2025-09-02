import frappe
from frappe import _

@frappe.whitelist()
def get_bom_rate_for_item(item_code, company, quotation_name=None, current_profit_percentage=None):
    """
    Get BOM rate for item based on criteria:
    - custom_allow_in_quotation = 1
    - is_default = 1
    - is_active = 1
    
    Returns the custom_net_cost from BOM as the final rate (no profit percentage calculation)
    """
    try:
        if not item_code or not company:
            return {
                "rate": None,
                "message": "Item code and company are required"
            }
        
        # Check if item has valid BOM
        filters = {
            "item": item_code,
            "custom_allow_in_quotation": 1,
            "is_default": 1,
            "is_active": 1,
            "docstatus": 1
        }
        
        bom = frappe.get_value("BOM", filters, 
                              ["custom_net_cost", "quantity", "currency"], as_dict=1)
        
        if bom:
            # Calculate unit cost from BOM using custom_net_cost - this will be the final rate
            unit_cost = bom.custom_net_cost / bom.quantity
            
            return {
                "rate": unit_cost,  # Direct rate from custom_net_cost
                "message": "BOM rate fetched successfully",
                "bom_details": {
                    "custom_net_cost": bom.custom_net_cost,
                    "quantity": bom.quantity,
                    "currency": bom.currency
                }
            }
        else:
            return {
                "rate": None,
                "message": "No valid BOM found for this item"
            }
            
    except Exception as e:
        frappe.log_error(f"Error fetching BOM rate for {item_code}: {str(e)}")
        return {
            "rate": None,
            "error": str(e)
        }

@frappe.whitelist()
def get_bom_rates_for_multiple_items(item_codes, company):
    """
    Get BOM rates for multiple items at once
    """
    try:
        if not item_codes or not company:
            return {
                "bom_rates": {},
                "message": "Item codes and company are required"
            }
        
        if isinstance(item_codes, str):
            item_codes = frappe.parse_json(item_codes)
        
        bom_rates = {}
        
        for item_code in item_codes:
            if item_code:
                result = get_bom_rate_for_item(item_code, company)
                if result.get("rate"):
                    bom_rates[item_code] = result["rate"]
        
        return {
            "bom_rates": bom_rates,
            "message": f"Fetched BOM rates for {len(bom_rates)} items"
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching BOM rates for multiple items: {str(e)}")
        return {
            "bom_rates": {},
            "error": str(e)
        }
