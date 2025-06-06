---
title: 'Home'
date: 2023-10-24
type: landing

design:
  # Default section spacing
  spacing: "6rem"

sections:
  - block: hero
    content:
      title: Design Chips. Build the Future
      text: "UWASIC is a student design team at the University of Waterloo dedicated to exploring the world of ASIC and FPGA development. <br><br> Our mission is to bridge the gap between academic learning and industry practice, preparing the next generation of chip designers"
      primary_action:
        text: Join Us
        url: /#join-us
        icon: user-plus
      # secondary_action:
      #   text: Sponsorships
      #   url: /sponsors
      # announcement:
      #   text: "Applications are open for the S25 Term!"
      #   link:
      #     text: "Read more about the team"
      #     url: "/blog/"
    design:
      spacing:
        padding: [0, 0, 0, 0]
        margin: [0, 0, 0, 0]
      # For full-screen, add `min-h-screen` below
      css_class: "dark"
      background:
        color: "red"
        image:
          # Add your image background to `assets/media/`.
          filename: bg-triangles.svg
          filters:
            brightness: 0.5
  - block: features
    id: features
    design:
      spacing:
        padding: [0, 0, 0, 0]
        margin: [0, 0, 0, 0]
      # For full-screen, add `min-h-screen` below
      background:
        color: "bg-primary-700"
    content:
      title: Why Join Us?
      items:
        - name: Bridge the Academia-Industry Gap
          icon: cpu-chip
          description: Get hands-on experience with professional-grade ASIC/FPGA tools and workflows. Build a project portfolio that stands out in internships and job applications
        - name: Low Risk, High Reward
          icon: bolt
          description: Learn chip design fundamentals and workflows without needing graduate-level specialization
        - name: Grow Your Network
          icon: user-group
          description: Connect with industry mentors, alumni, and peers passionate about hardware
  - block: markdown
    class: "text-center"
    design:
      spacing:
        padding: [0, 0, 0, 0]
        margin: [0, 0, 0, 0]
    content:
      title: Our Previous Projects
      text: | 
        <div id="demo">
          <canvas id="c" width="1344" height="699"></canvas>
            <div id="controls">
              <div>
                  Speed: <div id="speed_display">2^0</div>
                  <input id="speed" type="range" min="-5" max="17" value="11">
              </div>
              <div>
                  Show: 
                  <select id="show_select">
                      <option value="circuit+screen">circuit+screen</option>
                      <option value="screen">screen</option>
                      <option value="circuit">circuit</option>
                  </select>
              </div>
              <div>
                  Circuit: 
                  <select id="circuit_select" style="width: 150px;">
                      <option value="10_tt_um_uwasic_dinogame">Dino Game</option>
                  </select>
                  <span id="circuit_info"><a href="https://tinytapeout.com/runs/ttihp25a/tt_um_uwasic_dinogame">project info</a></span>
              </div>        
          </div>
        </div>

        <script src="swissgl.js"></script>
        <script src="sim.js"></script>

        <script>
            "use strict";
            const $ = q=>document.querySelector(q);
            const canvas = $('#c');
            const glsl = SwissGL(canvas);

            const ca_project = '10_tt_um_uwasic_dinogame';
            let sim;
            let skip_n = 0;
            let needBreak = false;
            let project;
            async function init() {
                sim = await VGASimulator.init(glsl);
                await load_circuit();
                glsl.loop(frame);
            }

            async function load_circuit() {
                project = "10_tt_um_uwasic_dinogame";
                const url = `gds/${project}.json`; 
                const response = await fetch(url);
                const data = await response.json();
                sim.load_circuit(data);
                const [tt, ...rest] = project.split('_');
                const name = rest.join('_');
            }

            function updateStatus(line) {
                if (project != ca_project)
                    return;
                let status = 'copy the previous row';
                if (line < 0 || line >= H) {
                    status = 'offscreen (skip)';
                } else if (line == 0) {
                    status = 'recall the starting row';
                } else if (line == 4) {
                    status = 'rule application + store the first row for the next frame'
                } else if (line%4 == 0) {
                    status = 'apply CA rule';
                }
            }

            function frame() {
                glsl.adjustCanvas();

                const speed = $('#speed').value;
                const step_n = Math.pow(2, speed);
                $('#speed_display').textContent = '2^'+speed;
                if (step_n >= 1) {
                    for (let i=0; i<step_n && !needBreak; ++i) {
                        sim.step(updateStatus);
                    }
                } else {
                    if (skip_n <= 0) {
                        sim.step(updateStatus);
                        skip_n = 1/step_n-1;
                    } else {
                        skip_n--;
                    }   
                }
                needBreak = false;

                const show = $('#show_select').value;
                if (show =='circuit') {
                    sim.draw_circuit(step_n);
                } else if (show == 'screen') {
                    sim.draw_screen(step_n);
                } else if (show == 'circuit+screen') {
                    sim.draw_circuit(step_n);
                    sim.draw_screen(step_n, 0.6);
                }
            }

            init();
        </script> 

  # - block: form

  # - block: cta-image-paragraph
  #   id: solutions
  #   content:
  #     items:
  #       - title: Build your future-proof website
  #         text: As easy as 1, 2, 3!
  #         feature_icon: check
  #         features:
  #           - "Future-proof - edit your content in text files"
  #           - "Website is generated by a single app, Hugo"
  #           - "No JavaScript knowledge required"
  #         # Upload image to `assets/media/` and reference the filename here
  #         image: build-website.png
  #         button:
  #           text: Get Started
  #           url: https://hugoblox.com/templates/
  #       - title: Large Community
  #         text: Join our large community on Discord - ask questions and get live responses
  #         feature_icon: bolt
  #         features:
  #           - "Dedicated support channel"
  #           - "3,000+ users on Discord"
  #           - "Share your site and get feedback"
  #         # Upload image to `assets/media/` and reference the filename here
  #         image: coffee.jpg
  #         button:
  #           text: Join Discord
  #           url: https://discord.gg/z8wNYzb
  # - block: testimonials
  #   content:
  #     title: ""
  #     text: ""
  #     items:
  #       - name: "Hugo Smith"
  #         role: "Marketing Executive at X"
  #         # Upload image to `assets/media/` and reference the filename here
  #         image: "testimonial-1.jpg"
  #         text: "Awesome, so easy to use and saved me so much work with the swappable pre-designed sections!"
  #   design:
  #     spacing:
  #       # Reduce bottom spacing so the testimonial appears vertically centered between sections
  #       padding: ["6rem", 0, 0, 0]
  - block: cta-card
    id: join-us
    content:
      title: Ready to Join?
      text: "We're looking for passionate students interested in hardware design, ASIC development, and digital systems. <br><br>
      Please join the Discord and complete the onboarding!"
      button:
        text: Join Our Discord
        url: https://discord.gg/rnfTvG9ckY
        
    design:
      card:
        # Card background color (CSS class)
        css_class: "bg-primary-700"
        css_style: ""

---

