// DSI ERP - Quotation BOM Rate Fetching
// Field name: custom_bom_rate

// Function to check if quotation is submitted
function is_quotation_submitted(frm) {
    return frm.doc.docstatus === 1; // 1 means submitted
}

frappe.ui.form.on('Quotation', {
    refresh: function(frm) {
        // Only add Update BOM Cost button if quotation is not submitted
        if (!is_quotation_submitted(frm)) {
            if (!frm.custom_buttons || !frm.custom_buttons.update_bom_cost) {
                frm.add_custom_button(__('Update Cost'), function() {
                    update_all_items_bom_cost(frm);
                });
                
                frm.custom_buttons.update_bom_cost = true;
            }
        } else {
            // Remove the button if quotation is submitted
            if (frm.custom_buttons && frm.custom_buttons.update_bom_cost) {
                frm.remove_custom_button(__('Update Cost'));
                frm.custom_buttons.update_bom_cost = false;
            }
        }
    }
    // Removed custom_profit_percentage event handler as profit percentage is no longer used
});

frappe.ui.form.on('Quotation Item', {
    item_code: function(frm, cdt, cdn) {
        // Only fetch BOM rate if quotation is not submitted
        if (is_quotation_submitted(frm)) {
            return;
        }
        
        let item = locals[cdt][cdn];
        if (item.item_code) {
            fetch_bom_rate_for_item(frm, item);
        }
    },
    
    items_add: function(frm) {
        // Only fetch BOM rate if quotation is not submitted
        if (is_quotation_submitted(frm)) {
            return;
        }
        
        let new_item = frm.doc.items[frm.doc.items.length - 1];
        if (new_item.item_code) {
            fetch_bom_rate_for_item(frm, new_item);
        }
    }
});

// Fetch BOM rate for single item
function fetch_bom_rate_for_item(frm, item) {
    // Check if quotation is submitted before proceeding
    if (is_quotation_submitted(frm)) {
        frappe.msgprint(__('Cannot update costs after quotation is submitted.'));
        return;
    }
    
    if (!item.item_code || !frm.doc.company) return;
    
    frappe.call({
        method: 'dsi_erp.dsi_erp.quotation.quotation.get_bom_rate_for_item',
        args: {
            item_code: item.item_code,
            company: frm.doc.company,
            quotation_name: frm.doc.name
            // Removed current_profit_percentage as profit percentage is no longer used
        },
        callback: function(r) {
            if (r.message && r.message.rate) {
                // Update the main rate field directly from BOM custom_net_cost
                frappe.model.set_value('Quotation Item', item.name, 'rate', r.message.rate);
                
                // Set custom_cost_based_on_estimation to 1 when cost is updated from BOM
                if (!frm.doc.custom_cost_based_on_estimation) {
                    frappe.model.set_value('Quotation', frm.doc.name, 'custom_cost_based_on_estimation', 1);
                }
                
                // Show success message with rate
                let message = `Rate updated from BOM: ${r.message.rate}`;
                
                frappe.show_alert({
                    message: __(message),
                    indicator: 'green'
                }, 5);
            }
        }
    });
}

// Update all items BOM cost
function update_all_items_bom_cost(frm) {
    // Check if quotation is submitted before proceeding
    if (is_quotation_submitted(frm)) {
        frappe.msgprint(__('Cannot update costs after quotation is submitted.'));
        return;
    }
    
    if (!frm.doc.items || frm.doc.items.length === 0) {
        frappe.msgprint(__('No items found in quotation.'));
        return;
    }
    
    // Using BOM custom_net_cost directly
    
    // Show progress
    frm.dashboard.show_progress('Updating BOM Costs', 0, 100);
    
    // Collect items that have item codes
    let valid_items = frm.doc.items.filter(item => item.item_code);
    
    if (valid_items.length === 0) {
        frappe.msgprint(__('No valid items found.'));
        frm.dashboard.hide_progress();
        return;
    }
    
    let updated_count = 0;
    let total_items = valid_items.length;
    
    // Process items one by one to show progress
    valid_items.forEach(function(item, index) {
        frappe.call({
            method: 'dsi_erp.dsi_erp.quotation.quotation.get_bom_rate_for_item',
            args: {
                item_code: item.item_code,
                company: frm.doc.company,
                quotation_name: frm.doc.name
                // Removed current_profit_percentage as profit percentage is no longer used
            },
            callback: function(r) {
                if (r.message && r.message.rate) {
                    // Update the main rate field directly from BOM custom_net_cost
                    frappe.model.set_value('Quotation Item', item.name, 'rate', r.message.rate);
                    
                    updated_count++;
                }
                
                // Update progress
                let progress = Math.round((index + 1) / total_items * 100);
                frm.dashboard.show_progress('Updating BOM Costs', progress, 100);
                
                // Check if all items are processed
                if (updated_count === total_items || (index + 1) === total_items) {
                    frm.dashboard.hide_progress();
                    frm.refresh_field('items');
                    
                    if (updated_count > 0) {
                        // Set custom_cost_based_on_estimation to 1 when costs are updated from BOM
                        if (!frm.doc.custom_cost_based_on_estimation) {
                            frappe.model.set_value('Quotation', frm.doc.name, 'custom_cost_based_on_estimation', 1);
                        }
                        
                        let message = `Updated rates for ${updated_count} items from BOM`;
                        frappe.msgprint(__(message));
                    } else {
                        frappe.msgprint(__('No BOM rates found for the items.'));
                    }
                }
            }
        });
    });
}

// Alternative: Batch update method for better performance
function update_all_items_bom_cost_batch(frm) {
    // Check if quotation is submitted before proceeding
    if (is_quotation_submitted(frm)) {
        frappe.msgprint(__('Cannot update costs after quotation is submitted.'));
        return;
    }
    
    if (!frm.doc.items || frm.doc.items.length === 0) {
        frappe.msgprint(__('No items found in quotation.'));
        return;
    }
    
    // Collect all item codes
    let item_codes = frm.doc.items.map(item => item.item_code).filter(Boolean);
    
    if (item_codes.length === 0) {
        frappe.msgprint(__('No valid items found.'));
        return;
    }
    
    // Show progress
    frm.dashboard.show_progress('Updating BOM Costs', 0, 100);
    
    frappe.call({
        method: 'dsi_erp.dsi_erp.quotation.quotation.get_bom_rates_for_multiple_items',
        args: {
            item_codes: item_codes,
            company: frm.doc.company
        },
        callback: function(r) {
            frm.dashboard.hide_progress();
            
            if (r.exc) {
                frappe.msgprint(__('Error updating BOM costs: ') + r.exc);
            } else if (r.message && r.message.bom_rates) {
                // Update all items with BOM rates
                let updated_count = 0;
                
                frm.doc.items.forEach(function(item) {
                    if (r.message.bom_rates[item.item_code]) {
                        let bom_rate = r.message.bom_rates[item.item_code];
                        frappe.model.set_value('Quotation Item', item.name, 'bom_rate', bom_rate);
                        
                        // Set final rate as direct BOM cost (no profit percentage)
                        frappe.model.set_value('Quotation Item', item.name, 'rate', bom_rate);
                        
                        updated_count++;
                    }
                });
                
                frm.refresh_field('items');
                
                if (updated_count > 0) {
                    let message = `Updated BOM rates for ${updated_count} items (direct BOM costs, no profit margin)`;
                    frappe.msgprint(__(message));
                } else {
                    frappe.msgprint(__('No BOM rates found for the items.'));
                }
            }
        },
        freeze: true
    });
}

// Removed recalculate_rates_with_profit function as profit percentage is no longer used
