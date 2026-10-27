// Cuts raw.mp4 (from capture.cjs) into the X promo: 8 chain -> slow-mo zoom on
// the BIOCONNECT! call -> 7 chain -> end card.   node make-video.cjs
const { spawnSync } = require('child_process');
const path = require('path');
const dir = path.join(__dirname, '../../output/playwright/bioconnect-call-video');
const root = path.join(__dirname, '../..').split(path.sep).join('/');
const BOLD = 'C\\:/Windows/Fonts/georgiab.ttf', BLACK = 'C\\:/Windows/Fonts/seguibl.ttf';

// [start, end] in raw.mp4 seconds (capture-report.json: taps 2.15 / 9.01, calls 3.36 / 10.11)
const A = [0.6, 5.4], B = [3.25, 4.75], C = [7.4, 12.3];
const SLOW = 2, END = 3.2;

const band = 'drawbox=x=0:y=0:w=iw:h=330:color=0x10170f@0.94:t=fill';
const caption = (t, size = 76, y = 128) =>
  `drawtext=fontfile='${BOLD}':text='${t}':fontsize=${size}:fontcolor=0xf6efd8:x=(w-text_w)/2:y=${y}`;
const tag = t => `drawtext=fontfile='${BLACK}':text='${t}':fontsize=44:fontcolor=0x1a1408:box=1:boxcolor=0xf2c35a:boxborderw=18:x=48:y=380`;

const f = [
  `[0:v]trim=${A[0]}:${A[1]},setsar=1,setpts=PTS-STARTPTS,${band},${caption('Chain 7 or more...')}[va]`,
  `[0:a]atrim=${A[0]}:${A[1]},asetpts=PTS-STARTPTS[aa]`,
  `[0:v]trim=${B[0]}:${B[1]},setpts=${SLOW}*(PTS-STARTPTS),crop=772:1372:154:110,scale=1080:1920:flags=lanczos,setsar=1,fps=30,${band},${caption('...and the meadow shouts!')},${tag('SLOW-MO')}[vb]`,
  `[0:a]atrim=${B[0]}:${B[1]},asetpts=PTS-STARTPTS,atempo=0.5,volume=0.8[ab]`,
  `[0:v]trim=${C[0]}:${C[1]},setpts=PTS-STARTPTS,setsar=1,${band},${caption('Again. 7 chain.')}[vc]`,
  `[0:a]atrim=${C[0]}:${C[1]},asetpts=PTS-STARTPTS,afade=t=out:st=${C[1] - C[0] - 0.6}:d=0.6[ac]`,
  // end card: last frame of C, blurred and darkened, with the name and where to play
  `[0:v]trim=${C[1] - 0.04}:${C[1]},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${END},trim=0:${END},gblur=sigma=26,eq=brightness=-0.28,` +
    `drawtext=fontfile='${BLACK}':text='BIOCONNECT!':fontsize=128:fontcolor=0xf2c35a:borderw=6:bordercolor=0x1a1408:x=(w-text_w)/2:y=560,` +
    `drawtext=fontfile='${BOLD}':text='Raise the food chain.':fontsize=64:fontcolor=0xf6efd8:x=(w-text_w)/2:y=760,` +
    `drawtext=fontfile='${BOLD}':text='Free puzzle in your browser':fontsize=56:fontcolor=0xf6efd8@0.85:x=(w-text_w)/2:y=850,` +
    `drawtext=fontfile='${BOLD}':text='bioconnectpazzle.com':fontsize=70:fontcolor=0x1a1408:box=1:boxcolor=0xf2c35a:boxborderw=26:x=(w-text_w)/2:y=1500,` +
    `fade=t=in:st=0:d=0.3[vd0]`,
  `[1:v]scale=420:-1[ele]`,
  `[vd0][ele]overlay=x=(W-w)/2:y=1000,setsar=1[vd]`,
  `anullsrc=r=48000:cl=stereo,atrim=0:${END}[ad]`,
  `[va][aa][vb][ab][vc][ac][vd][ad]concat=n=4:v=1:a=1[v][a]`
].join(';');

const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, 'raw.mp4'), '-i', root + '/img/elephant-calm.png',
  '-filter_complex', f, '-map', '[v]', '-map', '[a]', '-r', '30',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', path.join(dir, 'bioconnect-call-x.mp4')];
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
process.exit(r.status);
