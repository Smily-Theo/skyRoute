#!/usr/bin/env python3
"""SkyRoute Intelligence — dependency-free local demo server."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import json, math, os, mimetypes

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
WEB = ROOT / "web"

def load(name):
    with (DATA / name).open(encoding="utf-8") as f: return json.load(f)
LOCATIONS = load("locations.json")
STATIONS = load("stations.json")
CONNECTIONS = load("connections.json")
LOC = {x["id"]: x for x in LOCATIONS}
STATION_BY_CITY = {s["city"]: s for s in STATIONS}

def distance(a,b):
    r=6371; p1=math.radians(a["lat"]); p2=math.radians(b["lat"])
    dp=math.radians(b["lat"]-a["lat"]); dl=math.radians(b["lon"]-a["lon"])
    h=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*r*math.asin(min(1,math.sqrt(h)))

def road_estimate(a,b,congestion=1.0):
    km=distance(a,b)*1.23
    minutes=km/42*60*congestion+12
    cost=km*5.8+90
    return km,minutes,cost

def valid_point(value):
    if not isinstance(value, dict): return False
    try:
        lat, lon = float(value['lat']), float(value['lon'])
        return math.isfinite(lat) and math.isfinite(lon) and 7.7 <= lat <= 13.7 and 75.8 <= lon <= 80.7
    except (KeyError, TypeError, ValueError): return False

def point_distance(a, b):
    return distance({'lat':float(a['lat']),'lon':float(a['lon'])},{'lat':float(b['lat']),'lon':float(b['lon'])})

def point_towards(a, b, km):
    # Approximate a point km from a towards b; suitable for a demo schematic, not navigation.
    total=point_distance(a,b)
    if total < 0.001: return {'lat':float(a['lat']),'lon':float(a['lon'])}
    fraction=min(0.45, km/total)
    return {'lat':float(a['lat'])+(float(b['lat'])-float(a['lat']))*fraction,
            'lon':float(a['lon'])+(float(b['lon'])-float(a['lon']))*fraction}

def compare_routes(body):
    origin_id=body.get('origin'); dest_id=body.get('destination')
    pref=str(body.get('preference','balanced')).lower()
    if pref not in ('fastest','cheapest','balanced','road_only'):
        return {'error':'Invalid route preference.'},400
    if origin_id == 'current_location':
        op=body.get('origin_point')
        if not valid_point(op): return {'error':'Current location is invalid or outside the supported Tamil Nadu demo area.'},400
        a={'id':'current_location','name':str(body.get('origin_name') or 'Your current location')[:100], 'lat':float(op['lat']),'lon':float(op['lon']),'district':'Current location','demand':0.4}
    elif origin_id in LOC: a=LOC[origin_id]
    else: return {'error':'Choose a valid Tamil Nadu origin or use Current location.'},400
    if dest_id == 'custom_destination':
        dp=body.get('destination_point')
        if not valid_point(dp): return {'error':'Destination coordinates are invalid or outside the supported Tamil Nadu demo area.'},400
        b={'id':'custom_destination','name':str(body.get('destination_name') or 'Selected destination')[:100], 'lat':float(dp['lat']),'lon':float(dp['lon']),'district':'Custom destination','demand':0.4}
    elif dest_id in LOC: b=LOC[dest_id]
    else: return {'error':'Choose a valid Tamil Nadu destination.'},400
    if a['id']==b['id'] or point_distance(a,b)<0.15: return {'error':'Origin and destination must be different.'},400
    try: congestion=max(0.7,min(2.5,float(body.get('congestion',1.0))))
    except (ValueError,TypeError): congestion=1.0
    km,mins,cost=road_estimate(a,b,congestion)
    road_segment={'mode':'road','from':a['name'],'to':b['name'],'duration_minutes':round(mins),'distance_km':round(km,1),'estimated_cost':round(cost),'simulated':False,
                  'coordinates':[[a['lat'],a['lon']],[b['lat'],b['lon']],]}
    routes=[{'id':'road-only','name':'Road-only journey','mode':'road','duration_minutes':round(mins),'estimated_cost':round(cost),'distance_km':round(km,1),'transfers':0,'is_simulated':False,'label':'Estimated road journey','segments':[road_segment],
             'geometry':[[a['lat'],a['lon']],[b['lat'],b['lon']]],'explanation':'Estimated using approximate road-distance and average-speed assumptions; this is not turn-by-turn navigation.'}]
    flying_enabled=bool(body.get('flying_car',True))
    if flying_enabled and point_distance(a,b)>5:
        # Concept takeoff ~2 km from origin and landing ~3 km before destination.
        # Both are generated for simulation and are not real/approved facilities.
        takeoff=point_towards(a,b,min(2.0,point_distance(a,b)*0.15))
        landing=point_towards(b,a,min(3.0,point_distance(a,b)*0.15))
        # Demo access legs target ~2 km at origin and ~3 km before destination.
        access_out=round(point_distance(a,takeoff),1)
        access_in=round(point_distance(landing,b),1)
        road_out_min=access_out/24*60+3
        road_in_min=access_in/24*60+3
        air_km=point_distance(takeoff,landing)
        air_min=air_km/180*60+8  # assumed cruise speed plus boarding/transition allowance
        air_cost=air_km*22+350
        total_min=road_out_min+air_min+road_in_min
        total_cost=access_out*5.8+air_cost+access_in*5.8+100
        segments=[
          {'mode':'road','step':1,'from':a['name'],'to':'Concept takeoff point','duration_minutes':round(road_out_min),'distance_km':round(access_out,1),'estimated_cost':round(access_out*5.8),'simulated':True,'coordinates':[[a['lat'],a['lon']],[takeoff['lat'],takeoff['lon']]],'instruction':f'Drive from {a["name"]} to a hypothetical takeoff point about {access_out:.1f} km away.'},
          {'mode':'air','step':2,'from':'Concept takeoff point','to':'Concept landing point','duration_minutes':round(air_min),'distance_km':round(air_km,1),'estimated_cost':round(air_cost),'simulated':True,'coordinates':[[takeoff['lat'],takeoff['lon']],[landing['lat'],landing['lon']]],'instruction':'Simulated eVTOL/flying-car segment. This is not an authorized air corridor or operating service.'},
          {'mode':'road','step':3,'from':'Concept landing point','to':b['name'],'duration_minutes':round(road_in_min),'distance_km':round(access_in,1),'estimated_cost':round(access_in*5.8),'simulated':True,'coordinates':[[landing['lat'],landing['lon']],[b['lat'],b['lon']]],'instruction':f'After landing, continue by road for approximately {access_in:.1f} km to reach {b["name"]}.'}
        ]
        routes.append({'id':'multimodal','name':'Road → flying-car concept → road','mode':'multimodal','duration_minutes':round(total_min),'estimated_cost':round(total_cost),'distance_km':round(access_out+air_km+access_in,1),'transfers':2,'is_simulated':True,'label':'Simulated concept route','segments':segments,
          'geometry':[[a['lat'],a['lon']],[takeoff['lat'],takeoff['lon']],[landing['lat'],landing['lon']],[b['lat'],b['lon']]],
          'explanation':'A three-stage concept: short road access, a simulated air leg, and a final road leg. Takeoff/landing points are generated for the demo only and are not real facilities.'})
    if pref=='road_only': routes=routes[:1]
    elif pref=='fastest': routes.sort(key=lambda r:r['duration_minutes'])
    elif pref=='cheapest': routes.sort(key=lambda r:r['estimated_cost'])
    else:
        max_minutes=max(x['duration_minutes'] for x in routes); max_cost=max(x['estimated_cost'] for x in routes)
        routes.sort(key=lambda r:(r['duration_minutes']/max_minutes+r['estimated_cost']/max_cost)/2)
    selected=routes[0]
    return {'origin':{'id':a['id'],'name':a['name'],'lat':a['lat'],'lon':a['lon']},'destination':{'id':b['id'],'name':b['name'],'lat':b['lat'],'lon':b['lon']},'preference':pref,'routes':routes,'selected_route_id':selected['id'],
      'warnings':['Road time and cost are estimates, not live traffic or turn-by-turn navigation.','Flying-car/eVTOL legs and takeoff/landing points are hypothetical simulations, not approved facilities or authorized flight corridors.']},200

def infrastructure(body):
    demand=float(body.get("demand_weight",40))/100; access=float(body.get("access_weight",35))/100; coverage=float(body.get("coverage_weight",25))/100
    total=demand+access+coverage
    if total<=0: demand,access,coverage=.4,.35,.25; total=1
    demand,access,coverage=demand/total,access/total,coverage/total
    rows=[]
    for city in LOCATIONS:
        nearest=min((distance(city,LOC[s['city']]) for s in STATIONS if s['city']!=city['id']),default=120)
        demand_score=city['demand']*100
        access_score=max(20,100-min(100,nearest)/2)
        coverage_score=min(100,nearest*1.25)
        score=round(demand*demand_score+access*access_score+coverage*coverage_score)
        rows.append({"id":city['id'],"city":city['name'],"district":city['district'],"lat":city['lat'],"lon":city['lon'],"score":score,"demand_score":round(demand_score),"access_score":round(access_score),"coverage_score":round(coverage_score),"nearest_hub_km":round(nearest),"recommendation":"High-priority concept candidate" if score>=75 else "Further assessment recommended" if score>=55 else "Monitor future demand","status":"candidate — not approved"})
    rows.sort(key=lambda x:x['score'],reverse=True)
    return {"candidates":rows,"weights":{"demand":round(demand*100),"access":round(access*100),"coverage":round(coverage*100)},"method":"Illustrative weighted index using supplied city demand proxies and distance to concept hubs. Not a feasibility or aviation safety assessment.","count":len(rows)}

def simulate(body):
    demand=max(0.1,min(3,float(body.get('demand',1))))
    congestion=max(0.7,min(2.5,float(body.get('congestion',1.25))))
    capacity=max(4,min(80,int(body.get('capacity',24))))
    frequency=max(1,min(8,int(body.get('frequency',3))))
    base_load=58*demand
    utilization=min(100,round(base_load/(capacity*frequency)*100))
    road_time=420*congestion
    air_time=165+18*congestion
    blended=round(road_time*(1-demand/(demand+1)) + air_time*(demand/(demand+1)))
    return {"metrics":{"estimated_demand_index":round(demand*100),"capacity_per_hour":capacity*frequency,"capacity_utilization_pct":utilization,"road_only_minutes":round(road_time),"multimodal_minutes":blended,"time_saved_minutes":max(0,round(road_time-blended)),"network_coverage_pct":min(95,round(44+frequency*5+demand*7)),"cost_index":round(100*(0.6+0.35*demand+0.12*frequency))},"chart":[{"label":"Road only","minutes":round(road_time)},{"label":"Multimodal concept","minutes":blended},{"label":"Peak congestion","minutes":round(road_time*1.18)}],"assumptions":{"demand":demand,"congestion":congestion,"capacity_per_vehicle":capacity,"frequency_per_hour":frequency},"notice":"All simulation results are illustrative scenario outputs, not forecasts or operational aircraft data."}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(WEB),**kwargs)
    def log_message(self,fmt,*args): print("[SkyRoute]",fmt%args)
    def send_json(self,data,status=200):
        raw=json.dumps(data).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.send_header('Access-Control-Allow-Origin','*'); self.end_headers(); self.wfile.write(raw)
    def do_OPTIONS(self): self.send_response(204); self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Headers','Content-Type'); self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS'); self.end_headers()
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/api/health': return self.send_json({"status":"ok","app":"SkyRoute Intelligence","version":"1.1.0","data_mode":"local demo estimates"})
        if path=='/api/locations': return self.send_json({"locations":LOCATIONS,"count":len(LOCATIONS)})
        if path=='/api/stations': return self.send_json({"stations":STATIONS,"count":len(STATIONS),"notice":"All listed stations are hypothetical concept locations."})
        if path=='/api/connections': return self.send_json({"connections":CONNECTIONS,"count":len(CONNECTIONS)})
        if path=='/api/infrastructure/candidates': return self.send_json(infrastructure({}))
        return super().do_GET()
    def do_POST(self):
        path=urlparse(self.path).path
        try:
            length=int(self.headers.get('Content-Length','0')); body=json.loads(self.rfile.read(length) or b'{}')
            if path=='/api/routes/compare': data,status=compare_routes(body); return self.send_json(data,status)
            if path=='/api/infrastructure/analyze': return self.send_json(infrastructure(body))
            if path=='/api/simulation/run': return self.send_json(simulate(body))
            return self.send_json({"error":"Endpoint not found"},404)
        except (ValueError,TypeError,json.JSONDecodeError) as e: return self.send_json({"error":"Invalid request data","detail":str(e)},400)
        except Exception as e: return self.send_json({"error":"Unexpected server error","detail":str(e)},500)

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser(); p.add_argument('--host',default=os.environ.get('HOST','127.0.0.1')); p.add_argument('--port',type=int,default=int(os.environ.get('PORT','8000'))); args=p.parse_args()
    print(f"\n  SkyRoute Intelligence is running at http://{args.host}:{args.port}\n  API health: http://{args.host}:{args.port}/api/health\n  Press Ctrl+C to stop.\n")
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
