#!/usr/bin/env python

# Loops all js includes in index.html except for jquery and the bundle
# itself and combine all files into bundle.js.
#
# No minify etc. just plain merging into a single file.

import os
import re

bundle = open('www/js/bundle.js', 'w')

for index_line in open('www/index.html'):
	src = re.search('script src="(.*)"', index_line)
	if src != None:
		path_name = 'www/' + src.group(1)
		if path_name.startswith('www/js/jquery'): continue
		if path_name.startswith('www/js/bundle'): continue

		print path_name

		bundle.write('/**** FILE js/' + src.group(1) + ' STARTS HERE ****/\n')
		for line in open(path_name):
			bundle.write(line);

bundle.close()

print 'jsmin bundle.js => bundle.min.js'
os.system('jsmin www/js/bundle.js > www/js/bundle.min.js');
