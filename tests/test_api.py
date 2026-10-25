"""Dependency-free API/domain smoke tests. Run: python -m unittest discover -s tests -v"""
import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'app'))
import server

class SkyRouteTests(unittest.TestCase):
    def test_locations_are_present(self):
        self.assertGreaterEqual(len(server.LOCATIONS), 38)
        self.assertEqual(len(set(x["district"] for x in server.LOCATIONS)), 38)
        self.assertIn('chennai', server.LOC)
    def test_route_comparison(self):
        data, status = server.compare_routes({'origin':'dindigul','destination':'chennai','preference':'balanced'})
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(data['routes']), 1)
        self.assertEqual(data['origin']['name'], 'Dindigul')
    def test_road_only_excludes_air(self):
        data, status = server.compare_routes({'origin':'dindigul','destination':'chennai','preference':'road_only'})
        self.assertEqual(status, 200)
        self.assertEqual(len(data['routes']), 1)
        self.assertFalse(data['routes'][0]['is_simulated'])
    def test_same_location_rejected(self):
        data, status = server.compare_routes({'origin':'chennai','destination':'chennai'})
        self.assertEqual(status, 400)
        self.assertIn('error', data)
    def test_unknown_location_rejected(self):
        data, status = server.compare_routes({'origin':'unknown','destination':'chennai'})
        self.assertEqual(status, 400)
    def test_infrastructure_scores(self):
        data = server.infrastructure({})
        self.assertEqual(data['count'], len(server.LOCATIONS))
        self.assertTrue(all(0 <= x['score'] <= 100 for x in data['candidates']))
    def test_multimodal_has_three_leg_itinerary(self):
        data, status = server.compare_routes({'origin':'dindigul','destination':'chennai','preference':'balanced','flying_car':True})
        self.assertEqual(status, 200)
        route = next(r for r in data['routes'] if r['id'] == 'multimodal')
        self.assertEqual([s['mode'] for s in route['segments']], ['road','air','road'])
        self.assertTrue(all(len(s['coordinates']) >= 2 for s in route['segments']))
        self.assertTrue(route['is_simulated'])

    def test_flying_car_toggle_disables_air_route(self):
        data, status = server.compare_routes({'origin':'dindigul','destination':'chennai','preference':'balanced','flying_car':False})
        self.assertEqual(status, 200)
        self.assertTrue(all(r['id'] != 'multimodal' for r in data['routes']))

    def test_current_location_coordinates(self):
        data, status = server.compare_routes({'origin':'current_location','origin_point':{'lat':9.9252,'lon':78.1198},'origin_name':'My current location','destination':'chennai','preference':'balanced'})
        self.assertEqual(status, 200)
        self.assertEqual(data['origin']['name'], 'My current location')

    def test_outside_tamil_nadu_current_location_rejected(self):
        data, status = server.compare_routes({'origin':'current_location','origin_point':{'lat':28.6,'lon':77.2},'destination':'chennai'})
        self.assertEqual(status, 400)

    def test_simulation_metrics(self):
        data = server.simulate({'demand':1,'congestion':1.25,'capacity':24,'frequency':3})
        self.assertIn('time_saved_minutes', data['metrics'])
        self.assertGreater(data['metrics']['capacity_per_hour'], 0)

if __name__ == '__main__': unittest.main()
