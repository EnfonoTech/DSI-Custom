frappe.ui.form.on("Item", {
    item_group(frm) {
        if (frm.doc.item_group) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Item Group",
                    name: frm.doc.item_group
                },
                callback: function(r) {
                    if (r.message) {
                        build_prefix(r.message, function(prefix) {
                            // Get next item code using filter
                            get_next_item_code_filter(prefix, function(item_code) {
                                frm.set_value("item_code", item_code);
                            });
                        });
                    }
                }
            });
        } else {
            // Clear the item_code when item_group is cleared
            frm.set_value("item_code", "");
        }
    }
});

function build_prefix(group, callback) {
    let code = (group.item_group_name || "").replace(/\s+/g, "").substring(0,2).toUpperCase();

    if (group.parent_item_group && group.parent_item_group !== "All Item Groups") {
        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Item Group",
                name: group.parent_item_group
            },
            callback: function(r) {
                if (r.message) {
                    build_prefix(r.message, function(parent_code) {
                        callback(parent_code + code);
                    });
                } else {
                    callback(code);
                }
            }
        });
    } else {
        callback(code);
    }
}

function get_next_item_code_filter(prefix, callback) {
    // Use frappe.get_list to get all items with the same prefix
    let filters = [["item_code", "like", prefix + "-%"]];
    
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Item",
            filters: filters,
            fields: ["item_code"],
            order_by: "item_code asc"
        },
        callback: function(r) {
            let next_number = 1;
            
            if (r.message && r.message.length > 0) {
                // Extract all numbers from existing item codes
                let existing_numbers = [];
                r.message.forEach(function(item) {
                    let item_code = item.item_code;
                    if (item_code && item_code.startsWith(prefix + "-")) {
                        let number_str = item_code.replace(prefix + "-", "");
                        let number = parseInt(number_str);
                        if (!isNaN(number)) {
                            existing_numbers.push(number);
                        }
                    }
                });
                
                // Sort numbers and find the first gap or next number
                existing_numbers.sort(function(a, b) { return a - b; });
                
                // Find the first missing number starting from 1
                for (let i = 1; i <= existing_numbers.length + 1; i++) {
                    if (!existing_numbers.includes(i)) {
                        next_number = i;
                        break;
                    }
                }
            }
            
            let item_code = prefix + "-" + String(next_number).padStart(4, '0');
            callback(item_code);
        },
        error: function(err) {
            callback(prefix + "-0001");
        }
    });
}

