from typing import List, Dict

def calculate_landed_costs(
    lines: List[Dict],
    exchange_rate: float,
    customs_duty_pct: float,
    ancillaries: Dict[str, float],
    allocation_key: str
) -> List[Dict]:
    total_ancillary = sum(ancillaries.values())
    
    total_value = 0.0
    total_weight = 0.0
    total_quantity = 0
    
    # First pass: calc FOB, duty and totals
    for line in lines:
        qty = float(line.get("quantity") or line.get("quantite") or line.get("qty") or 0)
        unit_price_usd = float(line.get("unit_price_usd") or line.get("unit_price") or line.get("fob") or line.get("prix_unitaire") or 0.0)
        weight_kg = float(line.get("weight_kg") or line.get("poids") or line.get("weight") or 0.0)
        sku = str(line.get("sku") or line.get("SKU") or line.get("ref") or "").strip()
        
        line["sku"] = sku
        line["quantity"] = int(qty)
        line["unit_price_usd"] = unit_price_usd
        line["weight_kg"] = weight_kg
        
        line_fob_mad = qty * unit_price_usd * exchange_rate
        line["fob_mad"] = line_fob_mad
        line["duty_mad"] = line_fob_mad * (customs_duty_pct / 100.0)
        
        total_value += line_fob_mad
        total_weight += (qty * weight_kg)
        total_quantity += qty
        
    # Second pass: distribute ancillary and calc final unit cost
    for line in lines:
        qty = line.get("quantity", 0)
        if qty == 0:
            line["landed_cost_mad"] = 0.0
            continue
            
        ratio = 0.0
        if allocation_key == "VALUE" and total_value > 0:
            ratio = line["fob_mad"] / total_value
        elif allocation_key == "WEIGHT" and total_weight > 0:
            ratio = (qty * line.get("weight_kg", 0.0)) / total_weight
        elif allocation_key == "QUANTITY" and total_quantity > 0:
            ratio = qty / total_quantity
            
        allocated_ancillary = total_ancillary * ratio
        total_line_cost = line["fob_mad"] + line["duty_mad"] + allocated_ancillary
        line["landed_cost_mad"] = total_line_cost / qty
        
    return lines
