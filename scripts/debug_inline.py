import re

def read_shared(name):
    with open(f'supabase/functions/_shared/{name}', 'r', encoding='utf-8') as f:
        return f.read()

def inline_shared(source):
    pattern = r"^import\s+\{[^}]+\}\s+from\s+'\.\./_shared/([^']+)'\s*;?\s*$"
    lines = source.split('\n')
    result = []
    for line in lines:
        match = re.match(pattern, line)
        if match:
            shared_file = match.group(1)
            shared_source = read_shared(shared_file)
            result.append(f'// ===== START {shared_file} =====')
            result.append(shared_source)
            result.append(f'// ===== END {shared_file} =====')
        else:
            result.append(line)
    return '\n'.join(result)

with open('supabase/functions/generate-invoice-pdf/index.ts', 'r', encoding='utf-8') as f:
    source = f.read()

inlined = inline_shared(source)
print('LENGTH:', len(inlined))
print(inlined[:500])
