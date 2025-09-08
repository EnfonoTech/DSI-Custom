frappe.ui.form.on("Item", {
    refresh: function(frm) {
        frm.set_df_property("item_code", "read_only", 1);
    },
    
    item_group: function(frm) {
        if (frm.doc.item_group) {
            if (frm.is_new()) {
                // For new items, generate the code immediately
                generate_item_code(frm);
            } else {
                // For existing items, show preview of what the new code would be
                frappe.call({
                    method: "dsi_erp.item_helpers.get_item_code_preview",
                    args: {
                        item_group: frm.doc.item_group,
                        current_item: frm.doc.name
                    },
                    callback: function(r) {
                        if (r.message && r.message !== frm.doc.item_code) {
                            frappe.msgprint({
                                title: __('Info'),
                                indicator: 'blue',
                                message: __('Changing item group will rename the item code to: {0} when you save the document.', [r.message])
                            });
                        }
                    }
                });
            }
        }
    }
});

function generate_item_code(frm) {
    frappe.call({
        method: "dsi_erp.item_helpers.get_item_code_preview",
        args: {
            item_group: frm.doc.item_group
        },
        callback: function(r) {
            if (r.message) {
                frm.set_value("item_code", r.message).then(() => {
                    frappe.show_alert({
                        message: __('Item code generated: {0}', [r.message]),
                        indicator: 'green'
                    });
                });
            }
        }
    });
}