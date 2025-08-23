import frappe
from frappe import _

@frappe.whitelist()
def get_bom_rate_for_item(item_code, company, quotation_name=None, current_profit_percentage=None):
    """
    Get BOM rate for item based on criteria:
    - custom_allow_in_quotation = 1
    - is_default = 1
    - is_active = 1
    
    Also calculates final rate with profit percentage if quotation is provided
    """
    try:
        if not item_code or not company:
            return {
                "bom_rate": None,
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
                              ["total_cost", "quantity", "currency"], as_dict=1)
        
        if bom:
            # Calculate unit cost from BOM
            unit_cost = bom.total_cost / bom.quantity
            
            # Use current profit percentage from form if provided, otherwise get from database
            profit_percentage = 0
            final_rate = unit_cost
            
            if current_profit_percentage is not None:
                # Use the current profit percentage from the form
                profit_percentage = float(current_profit_percentage) if current_profit_percentage else 0
            elif quotation_name:
                # Fallback to database value if no current_profit_percentage provided
                profit_percentage = frappe.get_value("Quotation", quotation_name, "custom_profit_percentage") or 0
            
            if profit_percentage > 0:
                final_rate = unit_cost * (1 + profit_percentage / 100)
            
            return {
                "custom_bom_rate": unit_cost,
                "final_rate": final_rate,
                "profit_percentage": profit_percentage,
                "message": "BOM rate fetched successfully",
                "bom_details": {
                    "total_cost": bom.total_cost,
                    "quantity": bom.quantity,
                    "currency": bom.currency
                }
            }
        else:
            return {
                "custom_bom_rate": None,
                "final_rate": None,
                "profit_percentage": 0,
                "message": "No valid BOM found for this item"
            }
            
    except Exception as e:
        frappe.log_error(f"Error fetching BOM rate for {item_code}: {str(e)}")
        return {
            "custom_bom_rate": None,
            "final_rate": None,
            "profit_percentage": 0,
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
                if result.get("bom_rate"):
                    bom_rates[item_code] = result["bom_rate"]
        
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
