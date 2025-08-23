// DSI ERP - Quotation BOM Rate Fetching
// Field name: custom_bom_rate

frappe.ui.form.on('Quotation', {
    refresh: function(frm) {
        // Add Update BOM Cost button
        if (!frm.custom_buttons || !frm.custom_buttons.update_bom_cost) {
            frm.add_custom_button(__('Update Cost'), function() {
                update_all_items_bom_cost(frm);
            });
            
            frm.custom_buttons.update_bom_cost = true;
        }
    },
    
    custom_profit_percentage: function(frm) {
        // Recalculate rates when profit percentage changes
        if (frm.doc.custom_profit_percentage && frm.doc.items) {
            recalculate_rates_with_profit(frm);
        }
    }
});

frappe.ui.form.on('Quotation Item', {
    item_code: function(frm, cdt, cdn) {
        let item = locals[cdt][cdn];
        if (item.item_code) {
            fetch_bom_rate_for_item(frm, item);
        }
    },
    
    items_add: function(frm) {
        let new_item = frm.doc.items[frm.doc.items.length - 1];
        if (new_item.item_code) {
            fetch_bom_rate_for_item(frm, new_item);
        }
    }
});

// Fetch BOM rate for single item
function fetch_bom_rate_for_item(frm, item) {
    if (!item.item_code || !frm.doc.company) return;
    
    frappe.call({
        method: 'dsi_erp.dsi_erp.quotation.quotation.get_bom_rate_for_item',
        args: {
            item_code: item.item_code,
            company: frm.doc.company,
            quotation_name: frm.doc.name,
            current_profit_percentage: frm.doc.custom_profit_percentage
        },
        callback: function(r) {
            if (r.message && r.message.custom_bom_rate) {
                // Update the custom_bom_rate field
                frappe.model.set_value('Quotation Item', item.name, 'custom_bom_rate', r.message.custom_bom_rate);
                
                // Update the main rate field with final rate (including profit)
                if (r.message.final_rate) {
                    frappe.model.set_value('Quotation Item', item.name, 'rate', r.message.final_rate);
                }
                
                // Show success message with details
                let message = `BOM Rate: ${r.message.custom_bom_rate}`;
                if (r.message.profit_percentage > 0) {
                    message += ` | Final Rate: ${r.message.final_rate} (${r.message.profit_percentage}% profit)`;
                }
                
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
    if (!frm.doc.items || frm.doc.items.length === 0) {
        frappe.msgprint(__('No items found in quotation.'));
        return;
    }
    
    // Show current profit percentage being used
    let current_profit = frm.doc.custom_profit_percentage || 0;
    if (current_profit > 0) {
        frappe.msgprint(__('Using current profit percentage: {0}%', [current_profit]));
    }
    
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
                quotation_name: frm.doc.name,
                current_profit_percentage: frm.doc.custom_profit_percentage
            },
            callback: function(r) {
                if (r.message && r.message.custom_bom_rate) {
                    frappe.model.set_value('Quotation Item', item.name, 'custom_bom_rate', r.message.custom_bom_rate);
                    
                    // Update the main rate field with final rate (including profit)
                    if (r.message.final_rate) {
                        frappe.model.set_value('Quotation Item', item.name, 'rate', r.message.final_rate);
                    }
                    
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
                        let message = `Updated BOM rates for ${updated_count} items`;
                        if (frm.doc.custom_profit_percentage > 0) {
                            message += ` with ${frm.doc.custom_profit_percentage}% profit margin`;
                        }
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
                        
                        // Calculate final rate with current profit percentage from form
                        let profit_percentage = frm.doc.custom_profit_percentage || 0;
                        if (profit_percentage > 0) {
                            let final_rate = bom_rate * (1 + profit_percentage / 100);
                            frappe.model.set_value('Quotation Item', item.name, 'rate', final_rate);
                        }
                        
                        updated_count++;
                    }
                });
                
                frm.refresh_field('items');
                
                if (updated_count > 0) {
                    let message = `Updated BOM rates for ${updated_count} items`;
                    if (frm.doc.custom_profit_percentage > 0) {
                        message += ` with ${frm.doc.custom_profit_percentage}% profit margin`;
                    }
                    frappe.msgprint(__(message));
                } else {
                    frappe.msgprint(__('No BOM rates found for the items.'));
                }
            }
        },
        freeze: true
    });
}

// Function to recalculate rates with profit percentage
function recalculate_rates_with_profit(frm) {
    if (!frm.doc.custom_profit_percentage || !frm.doc.items) return;
    
    let updated_count = 0;
    
    frm.doc.items.forEach(function(item) {
        if (item.custom_bom_rate && item.custom_bom_rate > 0) {
            let final_rate = item.custom_bom_rate * (1 + frm.doc.custom_profit_percentage / 100);
            frappe.model.set_value('Quotation Item', item.name, 'rate', final_rate);
            updated_count++;
        }
    });
    
    if (updated_count > 0) {
        frm.refresh_field('items');
        frappe.show_alert({
            message: __(`Recalculated rates for {0} items with {1}% profit margin`, 
                [updated_count, frm.doc.custom_profit_percentage]),
            indicator: 'blue'
        }, 5);
    }
}
