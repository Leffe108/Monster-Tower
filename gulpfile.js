var gulp = require('gulp');
var browserSync = require('browser-sync');
var watch = require('gulp-watch');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

/**
 * Runs a web server
 * - reloads css/audio/images upon change
 * - reloads page on changed index.html
 * - upon changed js files (except bundle.js and bundle.min.js),
 *   bundle files are rebuilt and then page is reloaded.
 */

gulp.task('webserver', function() {
	browserSync({
		notify: false,
		open: false,
		port: 9000,
		reloadDelay: 0, // [ms]
		ghostMode: false, // Cause more trouble than help for Monster Tower.
		server: {
			baseDir: 'www',
		}
	});

	gulp.watch([
		'www/index.html',
	]).on('change', function() {browserSync.reload()});

	gulp.watch([
		'www/audio/**/*',
	]).on('change', function() {browserSync.reload('www/audio/**/*')});

	gulp.watch([
		'www/css/*.css',
	]).on('change', function() {browserSync.reload('www/css/*.css')});

	gulp.watch([
		'www/images/**/*',
	]).on('change', function() {browserSync.reload('www/images/**/*')});

	gulp.watch([
		'www/js/*.js',
		'!www/js/bundle.js',
		'!www/js/bundle.min.js',
	], ['on_js_change']);
});

// re-builds bundle and then cause browser to reload.
gulp.task('on_js_change', ['bundle_js', 'minify_js'], function() {
	browserSync.reload(); // reload full page.
});

gulp.task('bundle_js', function() {
	return gulp.src(['www/js/*.js', '!www/js/bundle.js', '!www/js/bundle.min.js'])
		.pipe(concat('bundle.js'))
		.pipe(gulp.dest('./www/js/'));
});

gulp.task('minify_js', ['bundle_js'], function() {
	return gulp.src(['www/js/bundle.js'])
		.pipe(uglify({
			compress: false,
		}))
		.pipe(rename({extname: '.min.js'}))
		.pipe(gulp.dest('./www/js/'));
});

gulp.task('watch', function() {
	// watch tasks to re-build files
	gulp.watch(['www/js/*.js', '!www/js/bundle.js', '!www/js/bundle.min.js'], ['bundle_js']);
});

gulp.task('default', ['bundle_js', 'minify_js', 'webserver', 'watch']);
