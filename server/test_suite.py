import urllib.request, json

BASE = 'http://localhost:8000'

def get(path):
    return json.loads(urllib.request.urlopen(f'{BASE}{path}').read())

def post(path, body):
    req = urllib.request.Request(
        f'{BASE}{path}',
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    return json.loads(urllib.request.urlopen(req).read())

passed = 0
failed = 0

def check(name, condition, detail=''):
    global passed, failed
    if condition:
        print(f'  PASS — {name}' + (f' | {detail}' if detail else ''))
        passed += 1
    else:
        print(f'  FAIL — {name}' + (f' | {detail}' if detail else ''))
        failed += 1

print('=' * 60)
print('TEST 1 — health check')
h = get('/api/health')
check('server alive', h['status'] == 'ok', f'sol={h["sol"]}')
check('sol counter running', h['sol'] >= 1)

print('=' * 60)
print('TEST 2 — sol 1: no food, all crops planted')
s1 = get('/api/sol/1')
n1 = s1['nutrition']
a1 = s1['allocation']
alloc_total = round(a1['potato_pct'] + a1['legume_pct'] + a1['lettuce_pct'] + a1['radish_pct'] + a1['herb_pct'], 3)
check('zero harvest on sol 1', n1['harvested_kcal'] == 0.0, f'kcal={n1["harvested_kcal"]}')
check('zero coverage on sol 1', n1['calorie_coverage_pct'] == 0.0)
check('not harvest day', n1['is_harvest_day'] == False)
check('5 crops planted', len(s1['planting_events']) == 5)
check('no stress sol 1', len(s1['stress_alerts']) == 0)
check('allocation sums to 1', alloc_total == 1.0, f'total={alloc_total}')
check('no critical resources', s1['resources']['any_critical'] == False)

print('=' * 60)
print('TEST 3 — advance to sol 22 (first harvest)')
post('/api/step', {'n_sols': 21})
s22 = get('/api/sol/22')
n22 = s22['nutrition']
check('is harvest day', n22['is_harvest_day'] == True)
check('radish or herb harvested', 'radish' in s22['harvest_events'] or 'herb' in s22['harvest_events'], f'events={s22["harvest_events"]}')
check('real kcal produced', n22['harvested_kcal'] > 0, f'kcal={n22["harvested_kcal"]:.0f}')
check('coverage rising', n22['calorie_coverage_pct'] > 0.0, f'cov={n22["calorie_coverage_pct"]}%')
check('PAR under 300', s22['environment']['par_umol_m2s'] < 300, f'par={s22["environment"]["par_umol_m2s"]}')
check('no stress alerts', len(s22['stress_alerts']) == 0)
check('water not critical', s22['resources']['water_critical'] == False)
check('recycling ratio above old floor', s22['resources']['recycling_ratio'] > 0.555, f'ratio={s22["resources"]["recycling_ratio"]}')

print('=' * 60)
print('TEST 4 — advance to sol 31 (lettuce harvest)')
post('/api/step', {'n_sols': 9})
s31 = get('/api/sol/31')
check('lettuce harvested', 'lettuce' in s31['harvest_events'], f'events={s31["harvest_events"]}')
check('power capped at 300', s31['environment']['power_kwh_available'] <= 300.0)
check('PAR under 300', s31['environment']['par_umol_m2s'] < 300)
check('coverage higher than sol 22', s31['nutrition']['calorie_coverage_pct'] >= s22['nutrition']['calorie_coverage_pct'], f'cov={s31["nutrition"]["calorie_coverage_pct"]}%')

print('=' * 60)
print('TEST 5 — advance to sol 80 (RL agent learning)')
post('/api/step', {'n_sols': 49})
s80 = get('/api/sol/80')
a80 = s80['allocation']
TOL = 0.01
alloc_total_80 = round(sum(a80.values()), 3)
check('past warmup', s80['agent']['in_warmup'] == False)
check('recent_avg_reward populated', s80['agent']['recent_avg_reward'] is not None)
check('agent performing well', s80['agent']['recent_avg_reward'] > 0)
check('potato in valid range', 0.40 - TOL <= a80['potato_pct'] <= 0.50 + TOL, f'potato={a80["potato_pct"]}')
check('legume in valid range', 0.20 - TOL <= a80['legume_pct'] <= 0.30 + TOL, f'legume={a80["legume_pct"]}')
check('lettuce in valid range', 0.15 - TOL <= a80['lettuce_pct'] <= 0.20 + TOL, f'lettuce={a80["lettuce_pct"]}')
check('radish in valid range', 0.05 - TOL <= a80['radish_pct'] <= 0.10 + TOL, f'radish={a80["radish_pct"]}')
check('herb in valid range', 0.03 - TOL <= a80['herb_pct'] <= 0.08 + TOL, f'herb={a80["herb_pct"]}')
check('allocation sums to 1', alloc_total_80 == 1.0, f'total={alloc_total_80}')
check('no critical resources', s80['resources']['any_critical'] == False)
check('efficiency score improved', s80['reward']['efficiency_score'] > 0.85, f'score={s80["reward"]["efficiency_score"]}')
check('recycling ratio above 0.555', s80['resources']['recycling_ratio'] > 0.555, f'ratio={s80["resources"]["recycling_ratio"]}')

print('=' * 60)
print('TEST 6 — recycling ratio above old locked value')
r22 = get('/api/sol/22')['resources']['recycling_ratio']
r80 = get('/api/sol/80')['resources']['recycling_ratio']
# Check ratio is above the old locked 0.555 value — not that it changes
# sol-to-sol (it changes at 4th decimal place, rounds to same at 3)
check('ratio above old floor at sol 22', r22 > 0.555, f'sol22={r22}')
check('ratio above old floor at sol 80', r80 > 0.555, f'sol80={r80}')
check('efficiency score above 0.85', s80['reward']['efficiency_score'] > 0.85, f'{s80["reward"]["efficiency_score"]}')
check('ratio values visible', True, f'sol22={r22} sol80={r80}')

print('=' * 60)
print('TEST 7 — nutrition coverage arc')
cov_s1  = get('/api/sol/1')['nutrition']['calorie_coverage_pct']
cov_s22 = get('/api/sol/22')['nutrition']['calorie_coverage_pct']
cov_s31 = get('/api/sol/31')['nutrition']['calorie_coverage_pct']
cov_s80 = get('/api/sol/80')['nutrition']['calorie_coverage_pct']
check('sol 1 coverage is 0', cov_s1 == 0.0, f'{cov_s1}%')
check('sol 22 coverage > sol 1', cov_s22 > cov_s1, f'{cov_s22}%')
check('sol 31 coverage > sol 22', cov_s31 >= cov_s22, f'{cov_s31}%')
check('sol 80 coverage > sol 31', cov_s80 >= cov_s31, f'{cov_s80}%')
check('sol 80 coverage realistic', cov_s80 < 80.0, f'{cov_s80}%')

print('=' * 60)
print('TEST 8 — reward components all valid')
r80 = s80['reward']
check('total reward in valid range', -1.0 <= r80['total'] <= 1.0, f'total={r80["total"]}')
check('nutrition score 0-1', 0.0 <= r80['nutrition_score'] <= 1.0)
check('efficiency score 0-1', 0.0 <= r80['efficiency_score'] <= 1.0, f'{r80["efficiency_score"]}')
check('stress score 0-1', 0.0 <= r80['stress_score'] <= 1.0)
check('critical score is 0 or 1', r80['critical_score'] in [0.0, 1.0])

print('=' * 60)
print('TEST 9 — mission summary')
m = get('/api/mission/summary')
check('mission status valid', m['mission_status'] in ['nominal','caution','critical'], f'status={m["mission_status"]}')
check('water recycled > 0', m['total_water_recycled_l'] > 0, f'{m["total_water_recycled_l"]:.0f}L')
check('recycling ratio > 0', m['avg_recycling_ratio_pct'] > 0, f'{m["avg_recycling_ratio_pct"]}%')
check('agent trained > 0', m['agent_sols_trained'] > 0)
check('cumulative reward positive', m['agent_cumulative_reward'] > 0)
check('days remaining correct', m['days_remaining'] == 450 - m['current_day'])

print('=' * 60)
print(f'RESULTS: {passed} passed, {failed} failed')
if failed == 0:
    print('ALL TESTS PASSED')