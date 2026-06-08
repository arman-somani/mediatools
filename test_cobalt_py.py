import urllib.request
import json

try:
    req = urllib.request.Request('https://instances.cobalt.tools/api/instances', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as response:
        instances = json.loads(response.read().decode())
    
    active = [i for i in instances if i.get('score', 0) > 90 and i.get('version', '').startswith('10.')]
    print(f"Found {len(active)} active high-score instances")
    
    for api in active[:5]:
        url = 'https://' + api['domain']
        print('\n=== Testing ' + url + ' ===')
        try:
            data = json.dumps({'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'downloadMode': 'audio'}).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                result = response.read().decode()
                print('Status:', response.status)
                if 'url' in result:
                    print('SUCCESS!', url)
                    print(result)
                    break
                else:
                    print(result[:100])
        except urllib.error.HTTPError as e:
            print('Failed HTTP:', e.code, e.read().decode()[:100])
        except Exception as e:
            print('Failed:', str(e))
except Exception as e:
    print('Global error:', str(e))
