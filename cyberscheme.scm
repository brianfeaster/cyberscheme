;;;
;;; fractal zoomer
;;;

;; Pixel Size (small=detailed/slower)
(set! GP 2)

;; Initial zoom
(set! mandiZoomStart .006)

;; Zoom speed (smaller=faster)
(set! mandiZoom .8)

;; Mandelbrot iter max (large==detailed/slower)
(set! mandiIterMax 2048)

;; Default zoom coordinates (after a reload)
;; Mouse click moves zoom location
(if (= mandiX ()) (begin
  (set! mandiX -1.6739439470203117)
  (set! mandiY -0.0007817426437768488)))

;; Constants
(set! canvasSize '(320 . 200)) ; Canvas size
(set! GW (quotient (car canvasSize) GP)) ; Draw size
(set! GH (quotient (cdr canvasSize) GP))
(set! GW/2 (quotient GW 2)) ; Half draw sizes
(set! GH/2 (quotient GH 2))

;; Library
(set! PROCID (car PROCINFO))
(set! PROCS (car (cdr PROCINFO)))
(set! map (lambda (f r) (if r (cons (f (car r)) (map f (cdr r))) '())))
(set! print (lambda (o . r) (display o) (map (lambda (o) (display " ") (display o)) r) (display "\n")))

;; Mandelbrot iterator
(set! mandi (lambda (mx my  ~)
  (set! ~ (lambda (i x y m n)
    (if (<= 4.0 (+ m n)) i
    (if (<= mandiIterMax i) #f
    (begin
      (set! y (+ (* 2 x y) my))
      (set! x (+ (- m n) mx))
      (~ (+ i 1) x y (* x x) (* y y)))))))
  (~ 0 0 0 0 0)))

(set! sawtooth (lambda (n r) (abs (- (% n (* 2 r)) r))))

(set! plot (lambda (x y w c)
  (if (eq? #f c)
    (gcolor 0 0 0)
    (gcolor (sawtooth (* c 5) 255)
            (sawtooth (+ (* c 11) 23) 255)
            255))
  (gbox (* x GP) (* y GP) (* w GP) GP)))

(set! mand (lambda (mx my zoom ~ x y k)
  (set! ~ (lambda (x y l c)
    (if (< y GH)
    (if (<= GW x) (begin
      (plot l y (+ 1 (- x l)) c)
      (~ 0 (+ y PROCS) 0 -1))
    (begin
      (set! k (mandi (+ mx (* (- x GW/2) zoom))
                     (+ my (* (- y GH/2) zoom))
                     '()))
      (if (= k c)
        (~ (+ x 1) y l c)
        (begin
          (plot l y (+ 1 (- x l)) c)
          (~ (+ x 1) y (+ x 1) k)))
      )))))
  (~ 0 PROCID  0 -1)))

(set! zoomer (lambda (zoom)
  (if (= 0 PROCID) (display (string "\n" mandiX " " mandiY " " zoom " ")))
  (display PROCID)
  (mand mandiX mandiY zoom '() '())
  (sync) ; make sure all procs acquire new coordinate sanely
  (set! mandiX (+ mandiX (* (/ (- mouseX 160) GP) zoom)))
  (set! mandiY (+ mandiY (* (/ (- mouseY 100) GP) zoom)))
  (set! mouseX 160) (set! mouseY 100) ; "reset" mouse to center
  (zoomer (* zoom mandiZoom))))

(begin
  (sync)
  (if (= PROCID 0) (begin (clear) (display "Procs:" PROCS "\n")))
  (sync)
  (zoomer mandiZoomStart))
