#!/usr/bin/env node

var fs = require('fs')
var youtubedl = require('youtube-dl')
var exec = require('child_process').exec
var range = require('lodash.range')
var moment = require('moment')
var async = require('async')
var remove = require('remove')
var path = require('path')
var exists = require('fs-exists-sync')

var url = process.argv[2].replace('https://', 'http://')
var clipLength = 1
var filename = process.argv[3] || 'output.mp4'

var tmpDir = path.join(__dirname, 'tmp')
var originalVideoPath = path.join(tmpDir, 'original.mp4')
var finishedFilePath = path.join(process.cwd(), filename)
var clipListPath = path.join(tmpDir, 'clip-list.txt')

var video = youtubedl(url, ['--format=18'])

var duration


if (exists(tmpDir)) {
  remove.removeSync(tmpDir)
}

fs.mkdirSync(tmpDir)
video.pipe(fs.createWriteStream(originalVideoPath))

video.on('info', function (info) {
  duration = info.duration
})

video.on('end', function (info) {
  var tasks = range(duration).map(function (sec) {
    return function (cb) {
      var startTime = moment().set({'hour': 0, 'minute': 0, 'second': sec}).format('HH:mm:ss')
      var cmd = 'ffmpeg -i ' + originalVideoPath + ' -ss ' + startTime + ' -t 00:00:01 -async 1 ' + path.join(tmpDir, 'cut-' + sec + '.mp4')
      exec(cmd, function (err) {
        if (err) cb(err)
        cb()
      })
    }
  })

  async.parallel(tasks, function (err) {
    if (err) throw err
    var filenamesToAppend = range(duration).reverse().map(function (sec) {
      return 'file ./cut-' + sec + '.mp4'
    })

    fs.openSync(clipListPath, 'w+')
    filenamesToAppend.forEach(function (filenameToAppend) {
      fs.appendFileSync(clipListPath, filenameToAppend + '\n')
    })

    var cmd = 'ffmpeg -f concat -i ' + clipListPath + ' -vcodec copy -acodec copy -y ' + finishedFilePath
    exec(cmd, function (err) {
      if (err) throw err
      remove.removeSync(tmpDir)
    })
  })
})