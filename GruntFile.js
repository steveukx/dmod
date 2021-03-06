module.exports = function(grunt) {

    'use strict';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        release: {
            options: {
                file: 'package.json',
                tagName: '<%= version %>', //default: '<%= version %>'
                commitMessage: 'Release <%= version %>', //default: 'release <%= version %>'
                tagMessage: 'Tag version <%= version %>' //default: 'Version <%= version %>'
            }
        }
    });

    grunt.loadNpmTasks('grunt-release-steps');

    grunt.registerTask('default', ['tag-patch']);

    // tags the project on the new version and pushes everything to remote
    'minor major patch'.split(' ').forEach(function(revision, typeOnly) {
        var tasks = [
            'release:bump:add:commit:' + revision,
            'release:push:tag:pushTags'
        ];

        grunt.registerTask('tag-' + revision, tasks);

        grunt.registerTask('release-' + revision, tasks.concat(['release:npm']));
    });
};
