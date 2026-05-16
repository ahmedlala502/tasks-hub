import re, csv, json

with open('src/ops/data/employeeRoster.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all employee objects from REAL_EMPLOYEE_ROSTER
roster_objs = re.findall(r'\{\s*"name":\s*"([^"]+)".*?\}', content, re.DOTALL)
# Actually, better: extract full objects
roster_matches = re.findall(r'\{[\s\S]*?"schedule":\s*\{[\s\S]*?\}\s*\}', content)

def get_email(name):
    parts = name.strip().split()
    parts = [p for p in parts if p]
    if len(parts) == 0:
        return 'user@trygc.com'
    if len(parts) == 1:
        return parts[0].lower() + '@trygc.com'
    return parts[0][0].lower() + '.' + parts[1].lower() + '@trygc.com'

rows = []
seen_emails = set()

# Parse roster objects manually with regex
for block in roster_matches:
    name = re.search(r'"name":\s*"([^"]+)"', block)
    city = re.search(r'"city":\s*"([^"]+)"', block)
    office = re.search(r'"office":\s*"([^"]+)"', block)
    dept = re.search(r'"department":\s*"([^"]+)"', block)
    role_task = re.search(r'"roleTask":\s*"([^"]+)"', block)
    shift = re.search(r'"shift":\s*"([^"]+)"', block)
    
    name = name.group(1) if name else 'Unknown'
    email = get_email(name)
    if email in seen_emails:
        continue
    seen_emails.add(email)
    rows.append({
        'name': name,
        'email': email,
        'role': role_task.group(1) if role_task else 'Operations Agent',
        'team': dept.group(1) if dept else 'Operations',
        'office': office.group(1) if office else 'Egypt',
        'city': city.group(1) if city else 'Cairo',
        'shift': shift.group(1) if shift else 'Morning',
        'password': 'Admin123',
        'status': 'active'
    })

# Parse core default access users
with open('src/ops/auth/defaultAccessUsers.ts', 'r', encoding='utf-8') as f:
    content2 = f.read()

# Extract CORE_DEFAULT_ACCESS_USERS array content
core_match = re.search(r'const CORE_DEFAULT_ACCESS_USERS: DefaultAccessUser\[\] = \[([\s\S]*?)\];', content2)
if core_match:
    core_blocks = re.findall(r'\{[\s\S]*?\}', core_match.group(1))
    for block in core_blocks:
        name = re.search(r"name:\s*'([^']+)'", block)
        email = re.search(r"email:\s*'([^']+)'", block)
        role = re.search(r"role:\s*'([^']+)'", block)
        office = re.search(r"office:\s*'([^']+)'", block)
        dept = re.search(r"department:\s*'([^']+)'", block)
        title = re.search(r"title:\s*'([^']+)'", block)
        
        if not email:
            continue
        e = email.group(1)
        if e in seen_emails:
            continue
        seen_emails.add(e)
        rows.append({
            'name': name.group(1) if name else 'Unknown',
            'email': e,
            'role': title.group(1) if title else (role.group(1) if role else 'Operations Agent'),
            'team': dept.group(1) if dept else 'Operations',
            'office': office.group(1) if office else 'Egypt',
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
