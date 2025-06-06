function prepareWASM(instance) {
    const type2class = {
        uint8_t: Uint8Array,
        float: Float32Array,
        int: Int32Array, 
        uint32_t: Uint32Array,
        uint64_t: BigUint64Array};
    const prefix = '_len_';
    const exports = instance.exports;
    const outputs = {};
    const arrays = {}
    for (const key in exports) {
        if (!key.startsWith(prefix)) {
            if (!key.startsWith('_')) {
                outputs[key] = exports[key];
            }
            continue;
        }
        const [name, type] = key.slice(prefix.length).split('__');
        Object.defineProperty(outputs, name, {
            enumerable: true,
            get() {
                if (!(name in arrays) || arrays[name].buffer != exports.memory.buffer) { 
                    const ofs = exports['_get_'+name]();
                    const len = exports[key]();
                    if (!ofs) {
                        return null;
                    }
                    arrays[name] = new (type2class[type])(exports.memory.buffer, ofs, len);
                }
                return arrays[name];
            }
        });
    }
    return outputs;
}

function array2tex(glsl, array, format, tag, w=256) {
    const {chn, CpuArray} = TextureFormats[format];
    const n = array.length/chn;
    const h = Math.ceil(n/w);
    const data = new CpuArray(w*h*chn);
    data.set(array);
    return glsl({}, {size:[w,h], data, format, tag});
}

const PAD = 48;
const W = 640+PAD*2, H = 480+PAD*2;

class VGASimulator {
    static async init(glsl) {
        const wasm = await WebAssembly.instantiateStreaming(fetch('gates.wasm'));
        return new VGASimulator(glsl, wasm);
    }

    constructor(glsl, wasm) {
        this.glsl = glsl;
        this.main = prepareWASM(wasm.instance);

        this.inc= `
        const vec2 justify = vec2(0.0, 1.0);
        vec2 fit(vec2 p, vec4 box) {
            vec2 V=vec2(ViewSize), B=box.zw-box.xy;
            float ab = B.x/B.y, av = V.x/V.y;
            vec2 s = min(vec2(ab/av, av/ab), 1.0);
            vec2 q = 2.0/B*s;
            return q*(p-box.xy)-s + justify*(q-s+1.0);
        }`;
    }
    
    load_circuit(json) {
        this.pins = json.pins;
        this.bbox = json.bbox;
        this.geom  = {
            rects: array2tex(glsl, json.wire_rects, 'rgba32f', 'rects'),
            infos: array2tex(glsl, json.wire_infos, 'rg32i', 'infos'),
        };
        this.out_wires = Array(8).fill(1).map((_,i)=>this.pins[`uo_out[${i}]`]);

        this.screen_row = new Uint8Array(W*4);
        this.screen = glsl({}, {size:[W,H], tag:'screen'});

        this.ray = [44, 33];
        this.tick = 0;

        const gates = json.gates;
        this.main.gate_n[0] = gates.luts.len;
        for (const name in gates) {
            const d = gates[name]
            const binary = atob(d.data);
            const u8 = new Uint8Array(binary.length);
            for (let i=0; i<binary.length; ++i) {
                u8[i] = binary.charCodeAt(i);
            }
            const a = new({'uint32':Uint32Array, 'uint64':BigUint64Array}[d.dtype])(u8.buffer);
            this.main[name].set(a);
        }
        this.main.state.fill(0);
        while (this.main.update_all());
        // console.time('bench');
        // for (let i=0; i<100_000; ++i) while(!this.step());
        // console.timeEnd('bench');
    }    

    sync_row() {
        const {glsl, ray} = this;
        const row = glsl({}, {data:this.screen_row, size:[W,1], tag:'row'});
        glsl({row, ray,
            VP:`XY.x,(ray.y+XY.y*0.5)/float(ViewSize.y)*2.0-1.0,0,1`,
            FP:`row(UV)`}, this.screen);
    }

    step(rowCallback=()=>{}) {
        const {main, tick, pins, screen_row} = this;
        const clk = tick&1;
        const rst_n = (tick>9) & 1; // ???
        const [R1, G1, B1, vsync, R0, G0, B0, hsync] = this.out_wires;
        const S = main.state;
        const prev_hsync = S[hsync];
        const prev_vsync = S[vsync];
        main.set_signal(pins.clk, clk);
        main.set_signal(pins.rst_n, rst_n);
        const cycleDone = main.run_wave()==0;
        this.tick += cycleDone;

        let [x, y] = this.ray;
        if (cycleDone && clk == 1) {
            if (x<W) {
                const p = x*4;
                screen_row[p+0] = S[R1]*170 + S[R0]*85;
                screen_row[p+1] = S[G1]*170 + S[G0]*85;
                screen_row[p+2] = S[B1]*170 + S[B0]*85;
            }
            x += 1;
        }
        if (prev_hsync && S[hsync]==0) {
            x = 0;
            this.sync_row();
            this.screen_row.fill(0);
            y += 1;
            if (rowCallback) rowCallback(y-33);
        }
        if (prev_vsync && S[vsync]==0) {
            x = 0;
            y = 0;
        }
        this.ray = [x, y];
        return cycleDone;
    }

    draw_circuit(speed) {
        const {glsl, geom, inc} = this;
        const size = [256, Math.ceil(this.main.gate_n[0]/256)];
        const state = glsl({}, {data:this.main.state, size, format:'r8u', tag:'state'});
        const heat = glsl({}, {data:this.main.heat, size, format:'r32f', tag:'heat'});
        this.main.cooldown(0.75**speed);
    
        glsl({cellBox:this.bbox, ...geom, state, heat,
            Grid:geom.rects.size, Blend:'s+d', Inc:inc+`
            uniform isampler2D infos;
            uniform usampler2D state;`, VP:`
            vec4 rect = rects(ID.xy);
            ivec4 info = texelFetch(infos, ID.xy, 0);
            int wire = info.x;
            varying vec4 color = vec4(0.6, 0.6, 0.6, 1.0);
            if (info.y >= 16) { // wire
                color = vec4(0.6, 0.6, 0.2, 1.0);
            } else if (info.y == 1) { // mem
                color = vec4(0.3, 0.9, 0.3, 1.0);
            } else if (info.y == 2) { // clock tree
                color = vec4(0.3, 0.7, 0.9, 1.0);
            } else if (info.y == 3) { // clock gate
                color = vec4(0.9, 0.3, 0.3, 1.0);
            }
            ivec2 wireI = ivec2(wire&0xff, wire>>8);
            float v = float(texelFetch(state, wireI, 0).x);
            float h = texelFetch(heat, wireI, 0).x;
            color *= 0.3+v*0.6;
            color.r += h;
            vec2 p = mix(rect.xy, rect.zw, UV);
            VPos.xy = fit(p, cellBox);`,
        FP:`color`});
    }

    draw_screen(speed=1, brightness=1) {
        const {glsl, ray, inc} = this;
        this.sync_row();
        glsl({WH:[W,H], ray, screen:this.screen, brightness, Inc:inc, Blend:'s+d',
            VP:`fit(vec2(UV.x, 1.0-UV.y)*WH, vec4(0,0,WH)),0,1`, FP:`
            vec4 c = screen(UV);
            float d = UV.y-(ray.y/WH.y);
            c *= d>0.0 ? clamp(d*10.0, 0.0, 1.0)*0.5+0.5 : 1.0;
            FOut = c*brightness`});

        glsl({ray, WH:[W,H], Inc:inc, r:Math.sqrt(speed)*0.5, Blend:'s+d',
            VP:`fit(vec2(ray.x, WH.y-ray.y-1.0)+4.0*XY*vec2(r,1), vec4(0,0,WH)), 0, 1`,
            FP:`exp(-dot(XY,XY)*2.0)*vec4(0.9,0.9,0.3,1.0)`}); 
    }
}
