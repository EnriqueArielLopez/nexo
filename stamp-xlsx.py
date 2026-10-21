"""Add the requested native Excel strike style, unsupported by the workbook SDK."""
import copy
import json
import os
import sys
import zipfile
import xml.etree.ElementTree as ET

filename, row_json = sys.argv[1:3]
rows = set(json.loads(row_json))
ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
q = lambda name: '{' + ns + '}' + name
with zipfile.ZipFile(filename) as source:
    files = {entry.filename: (entry, source.read(entry.filename)) for entry in source.infolist()}
styles = ET.fromstring(files['xl/styles.xml'][1])
sheet = ET.fromstring(files['xl/worksheets/sheet1.xml'][1])
fonts, xfs = styles.find(q('fonts')), styles.find(q('cellXfs'))
cache = {}
for row in sheet.iter(q('row')):
    if int(row.get('r')) not in rows:
        continue
    for cell in row.findall(q('c')):
        old = int(cell.get('s', '0'))
        if old not in cache:
            xf = copy.deepcopy(xfs[old])
            font = copy.deepcopy(fonts[int(xf.get('fontId', '0'))])
            strike = font.find(q('strike'))
            if strike is None:
                strike = ET.SubElement(font, q('strike'))
            strike.set('val', '1')
            fonts.append(font)
            xf.set('fontId', str(len(fonts) - 1))
            xf.set('applyFont', '1')
            xfs.append(xf)
            cache[old] = len(xfs) - 1
        cell.set('s', str(cache[old]))
fonts.set('count', str(len(fonts)))
xfs.set('count', str(len(xfs)))
files['xl/styles.xml'] = (files['xl/styles.xml'][0], ET.tostring(styles, encoding='utf-8', xml_declaration=True))
files['xl/worksheets/sheet1.xml'] = (files['xl/worksheets/sheet1.xml'][0], ET.tostring(sheet, encoding='utf-8', xml_declaration=True))
with zipfile.ZipFile(filename + '.strike', 'w', compression=zipfile.ZIP_DEFLATED) as target:
    for info, content in files.values():
        target.writestr(info, content)
os.replace(filename + '.strike', filename)
