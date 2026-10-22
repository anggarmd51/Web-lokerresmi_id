"""Run: python3 tests/editorial-contrast.browser.py [URL] [evidence-directory].
Requires Python Playwright and Chromium. Makes no form submissions and blocks API writes.
Checks WCAG AA 4.5:1 for all selected job-list text, including large headings.
"""
from pathlib import Path
import json
import re
import sys
from playwright.sync_api import sync_playwright, expect

url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
out = Path(sys.argv[2] if len(sys.argv) > 2 else '/workspace/lokerresmi-editorial-evidence/contrast-review')
out.mkdir(parents=True, exist_ok=True)
label = 'live' if url.startswith('https:') else 'local'
probe = """() => {
  const selectors = {
    heading: '.editorial-jobs h2', eyebrow: '.editorial-jobs > div:first-child p:first-child',
    results: '.editorial-jobs > div:first-child p:last-child', toolbar: '.editorial-jobs > div:first-child label',
    note: '.editorial-jobs > div:nth-child(2) > div > p', filter: '.editorial-filter summary',
    jobTitle: '.editorial-job-card h3', company: '.editorial-job-card p',
    source: '.editorial-source-meta', action: '.editorial-job-card a',
    salaryLabel: '.editorial-job-card b:first-child', deadlineLabel: '.editorial-job-card .mt-4 > span:last-child > b',
  };
  return Object.entries(selectors).map(([name, selector]) => {
    const el = document.querySelector(selector); if (!el) throw Error('Missing '+selector);
    let parent = el; let bg;
    while (parent) {
      bg = getComputedStyle(parent).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') break;
      parent = parent.parentElement;
    }
    return {name, color: getComputedStyle(el).color, background: bg};
  });
}"""

def rgb(value):
    return tuple(float(x) for x in re.findall(r'[\d.]+', value)[:3])

def luminance(color):
    vals = [v / 255 for v in rgb(color)]
    vals = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in vals]
    return sum(v * w for v, w in zip(vals, [0.2126, 0.7152, 0.0722]))

def measure(nodes):
    rows = []
    for node in nodes:
        a, b = sorted([luminance(node['color']), luminance(node['background'])])
        rows.append({**node, 'ratio': round((b + 0.05) / (a + 0.05), 4)})
    return rows

report = {'url': url, 'stable': {}, 'toggles': [], 'errors': []}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, color_scheme='light')
    page = context.new_page()
    page.on('pageerror', lambda e: report['errors'].append(str(e)))
    def safe(route):
        if route.request.method not in ('GET', 'HEAD', 'OPTIONS') and ('supabase.co' in route.request.url or '/api/' in route.request.url):
            route.abort()
        else:
            route.continue_()
    context.route('**/*', safe)
    page.goto(url, wait_until='networkidle')
    expect(page.locator('.editorial-job-card').first).to_be_visible()
    page.evaluate('document.fonts.ready')
    page.evaluate("""(probe) => {
      window.contrastProbe = eval('('+probe+')'); window.contrastFrames = [];
      new MutationObserver(() => {
        window.contrastFrames = [];
        const sample = () => {
          window.contrastFrames.push(window.contrastProbe());
          if (window.contrastFrames.length < 20) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }).observe(document.documentElement, {attributes:true, attributeFilter:['class']});
    }""", probe)
    report['stable']['light'] = measure(page.evaluate(probe))
    for index, theme in enumerate(['dark', 'light', 'dark', 'light']):
        page.get_by_role('button', name='Ganti ke mode gelap' if theme == 'dark' else 'Ganti ke mode terang', exact=True).click()
        page.wait_for_function('window.contrastFrames.length === 20')
        frames = [measure(nodes) for nodes in page.evaluate('window.contrastFrames')]
        minimum = min(row['ratio'] for frame in frames for row in frame)
        report['toggles'].append({'theme': theme, 'frames': len(frames), 'minimumRatio': minimum})
        report['stable'][theme] = frames[-1]
        page.locator('.editorial-job-card').first.hover()
        report['stable'][theme+'Hover'] = measure(page.evaluate(probe))
        page.mouse.move(0, 0)
        page.get_by_label('Posisi atau perusahaan', exact=True).fill('qa-empty-no-match-987')
        expect(page.locator('.editorial-empty')).to_be_visible()
        report['stable'][theme+'Empty'] = measure(page.locator('.editorial-empty p').evaluate('(el)=>[{name:"emptyText",color:getComputedStyle(el).color,background:getComputedStyle(el.parentElement).backgroundColor}]'))
        page.get_by_label('Posisi atau perusahaan', exact=True).fill('')
        expect(page.locator('.editorial-job-card').first).to_be_visible()
        print(theme, 'minimum frame contrast', minimum, flush=True)
        if index < 2:
            page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
            page.screenshot(path=str(out / f'{label}-{theme}-desktop.png'))
    page.set_viewport_size({'width': 390, 'height': 1000})
    page.screenshot(path=str(out / f'{label}-light-mobile.png'))
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    assert not report['errors'], report['errors']
    browser.close()
report['pass'] = all(t['minimumRatio'] >= 4.5 for t in report['toggles']) and all(row['ratio'] >= 4.5 for rows in report['stable'].values() for row in rows)
(out / f'{label}-contrast.json').write_text(json.dumps(report, indent=2) + '\n')
assert report['pass'], 'Contrast below WCAG AA; inspect JSON evidence.'
print('PASS', str(out / f'{label}-contrast.json'), flush=True)
