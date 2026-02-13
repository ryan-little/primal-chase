import math

# --- ADJUST THESE CONSTANTS TO TEST BALANCING ---
HUNTER_SPEED = 5.0
STARTING_GAP = 25.0

# ACTION COSTS (Per Day)
# Format: [Distance, Heat, Stamina, Thirst, Hunger]
PUSH_STATS = [6.0, 20, 20, 15, 10]
TROT_STATS = [3.0, 10, 10, 10, 5]

# DEATH THRESHOLDS
MAX_HEAT = 100
MIN_STAMINA = 0
MAX_THIRST = 100
MAX_HUNGER = 100

def simulate_strategy(name, stats):
    # Initial Ideal Conditions
    day = 0
    gap = STARTING_GAP
    heat = 0
    stamina = 100
    thirst = 0
    hunger = 0
    
    dist, d_heat, d_stam, d_thirst, d_hunger = stats

    print(f"\n--- SIMULATING PERPETUAL {name} ---")
    print(f"Daily Net Change: {dist - HUNTER_SPEED:+.1f} miles/day")
    
    while True:
        day += 1
        
        # Apply Movement
        gap += (dist - HUNTER_SPEED)
        
        # Apply Vital Changes
        heat += d_heat
        stamina -= d_stam
        thirst += d_thirst
        hunger += d_hunger
        
        # Check Fail Conditions
        death_reason = None
        if gap <= 0: death_reason = "CAUGHT BY HUNTERS"
        elif heat >= MAX_HEAT: death_reason = "HEATSTROKE"
        elif stamina <= MIN_STAMINA: death_reason = "EXHAUSTION"
        elif thirst >= MAX_THIRST: death_reason = "DEHYDRATION"
        elif hunger >= MAX_HUNGER: death_reason = "STARVATION"
        
        if death_reason:
            print(f"Day {day}: DIED ({death_reason})")
            print(f"Final Stats: Gap:{gap:.1f}mi | Heat:{heat}% | Stam:{stamina}% | Thirst:{thirst}%")
            return day

# Run simulations
simulate_strategy("PUSHING", PUSH_STATS)
simulate_strategy("TROTTING", TROT_STATS)