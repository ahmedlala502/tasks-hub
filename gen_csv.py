import json, re, ast, csv

with open('src/ops/data/employeeRoster.ts', 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'export const REAL_EMPLOYEE_ROSTER: EmployeeRosterEntry\[\] = (\[.*?\]);', content, re.DOTALL)
if not match:
    print('Could not find roster array')
    exit(1)

roster = ast.literal_eval(match.group(1))

def get_email(name):
    parts = name.strip().split()
    parts = [p for p in parts if p]
    if len(parts) == 0:
        return 'user@trygc.com'
    if len(parts) == 1:
        return parts[0].lower() + '@trygc.com'
    return parts[0][0].lower() + '.' + parts[1].lower() + '@trygc.com'

rows = []
for emp in roster:
    name = emp['name']
    email = get_email(name)
    role = emp.get('roleTask', 'Operations Agent')
    team = emp.get('department', 'Operations')
    office = emp.get('office', 'Egypt')
    city = emp.get('city', 'Cairo')
    shift = emp.get('shift', 'Morning')
    rows.append({
        'name': name,
        'email': email,
        'role': role,
        'team': team,
        'office': office,
        'city': city,
        'shift': shift,
        'password': 'Admin123',
        'status': 'active'
    })

with open('src/ops/auth/defaultAccessUsers.ts', 'r', encoding='utf-8') as f:
    content2 = f.read()

match2 = re.search(r'const CORE_DEFAULT_ACCESS_USERS: DefaultAccessUser\[\] = (\[.*?\]);', content2, re.DOTALL)
if match2:
    core_users = ast.literal_eval(match2.group(1))
    for u in core_users:
        if any(r['email'] == u['email'] for r in rows):
            continue
        rows.append({
            'name': u['name'],
            'email': u['email'],
            'role': u.get('title', 'Operations Agent'),
            'team': u.get('department', 'Operations'),
            'office': u.get('office', 'Egypt'),
            'city': 'Cairo',
            'shift': 'Morning',
            'password': 'Admin123',
            'status': 'active'
        })

with open('users_export.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['name','email','role','team','office','city','shift','password','status'])
    writer.writeheader()
    writer.writerows(rows)

print(f'Exported {len(rows)} users to users_export.csv')
