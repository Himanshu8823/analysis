import io, sys

def rewrite(path, pairs):
    with io.open(path, encoding='utf-8') as f:
        text = f.read()
    for old, new in pairs:
        if old not in text:
            print('  NOT FOUND:', old[:70])
            continue
        text = text.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('done', path)
