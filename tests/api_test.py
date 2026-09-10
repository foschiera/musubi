import json
import os
import subprocess
import time
import unittest
import urllib.request
import urllib.error
import tempfile
import shutil


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.process = subprocess.Popen(['./build/musubi'], env={**os.environ, 'MUSUBI_PORT': '18081'}, stdout=subprocess.DEVNULL)
        for _ in range(100):
            try:
                urllib.request.urlopen('http://127.0.0.1:18081/health', timeout=.2)
                return
            except OSError:
                time.sleep(.05)
        cls.process.terminate()
        raise RuntimeError('Server failed to start')

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=5)

    def request(self, path, body=None):
        req = urllib.request.Request('http://127.0.0.1:18081' + path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=3) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def test_dataset(self):
        self.assertEqual(self.request('/health')[0], 200)
        _, graph = self.request('/api/v1/graph')
        self.assertEqual(len(graph['nodes']), 8)
        self.assertEqual(len(graph['edges']), 9)
        _, event = self.request('/api/v1/events/evt_bandung?language=ja')
        self.assertEqual(event['narratives'][0]['language'], 'ja')
        self.assertIn('アジア', event['narratives'][0]['text'])
        self.assertTrue(event['sources'])

    def test_filter_and_limits(self):
        _, graph = self.request('/api/v1/graph?region=africa')
        self.assertTrue(all('africa' in n['region_ids'] for n in graph['nodes']))
        ids = {n['id'] for n in graph['nodes']}
        self.assertTrue(all(e['source_event_id'] in ids and e['target_event_id'] in ids for e in graph['edges']))
        _, graph = self.request('/api/v1/graph?limit=2')
        self.assertTrue(graph['truncated'])
        self.assertEqual(len(graph['nodes']), 2)
        self.assertEqual(self.request('/api/v1/graph?region=unknown')[0], 400)
        self.assertEqual(self.request('/api/v1/graph?unknown=yes')[0], 400)
        self.assertEqual(self.request('/api/v1/graph?limit=-1')[0], 400)
        self.assertEqual(self.request('/api/v1/events?limit=0')[0], 400)
        self.assertEqual(self.request('/api/v1/graph?from=1955-02-30')[0], 400)
        self.assertEqual(self.request('/api/v1/graph?from=1956-02-29')[0], 200)
        self.assertEqual(self.request('/api/v1/graph?from=1967&to=1947')[0], 400)

    def test_pagination(self):
        _, first = self.request('/api/v1/events?limit=2')
        _, second = self.request('/api/v1/events?limit=2&cursor=' + first['next_cursor'])
        self.assertFalse({e['id'] for e in first['items']} & {e['id'] for e in second['items']})
        self.assertEqual(first['total'], 8)

    def test_paths(self):
        body = {'from_event_id': 'evt_bandung', 'to_event_id': 'evt_g77', 'strategy': 'fewest_hops', 'filters': {}}
        _, route = self.request('/api/v1/paths', body)
        self.assertTrue(route['found'])
        self.assertEqual(len(route['relationships']), 2)
        body['filters'] = {'region_ids': ['southeast_asia']}
        self.assertFalse(self.request('/api/v1/paths', body)[1]['found'])
        body['filters'] = {}
        body['strategy'] = 'invalid'
        self.assertEqual(self.request('/api/v1/paths', body)[0], 400)
        self.assertEqual(self.request('/api/v1/paths', {})[0], 400)
        self.assertEqual(self.request('/api/v1/events/evt_missing')[0], 404)

    def test_invalid_dataset(self):
        with tempfile.TemporaryDirectory() as directory:
            shutil.copytree('data/demo', directory, dirs_exist_ok=True)
            path = os.path.join(directory, 'events.json')
            with open(path, encoding='utf8') as stream:
                events = json.load(stream)
            events[0]['source_ids'] = ['src_missing']
            with open(path, 'w', encoding='utf8') as stream:
                json.dump(events, stream)
            result = subprocess.run(['./build/musubi', '--validate', directory], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b'Unresolved reference', result.stderr)


if __name__ == '__main__':
    unittest.main()
