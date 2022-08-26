;;;
;;; fractal zoomer
;;;

;; Default zoom coordinates (after a reload)
;; Mouse click moves zoom location
(if (= mandiX ()) (begin
  (set! mandiX -1.6739439470203117)
  (set! mandiY -0.0007817426437768488)))

;; Initial zoom
(set! mandiZoomStart .005)

;; Zoom speed (smaller=faster)
(set! mandiZoom .7)

;; Pixel Size (small=prettier/slower)
(set! GP 2)

;; Mandelbrot iter max (large==prettier/slower)
(set! mandiIterMax 2000)

;; Constants
(set! canvasSize '(320 . 200)) ; Canvas size
(set! GW (quotient (car canvasSize) GP)) ; Draw size
(set! GH (quotient (cdr canvasSize) GP))
(set! GW/2 (quotient GW 2)) ; Half draw sizes
(set! GH/2 (quotient GH 2))

;; Library
(set! map (lambda (f r) (if r (cons (f (car r)) (map f (cdr r))) '())))
(set! print (lambda (o . r) (display o) (map (lambda (o) (display " ") (display o)) r) (display "\n")))

;; Mandelbrot iterator
(set! mandi (lambda (mx my  ~)
  (set! ~ (lambda (i x y m n)
    (if (<= 4.0 (+ m n))    (% (* i 11) 256)
    (if (<= mandiIterMax i) #f
    (begin
      (set! y (+ (* 2 x y) my))
      (set! x (+ (- m n) mx))
      (~ (+ i 1) x y (* x x) (* y y)))))))
  (~ 0 0 0 0 0)))

(set! plot (lambda (x y w c)
  (if (eq? #f c)
    (gcolor 0 0 0)
    (if (< c 128)
      (gcolor (- 255 (* c 2))
              (* c 2)
              255)
      (gcolor (- 255 (* (- 128 c) 2))
              (* (- 128 c) 2)
              255)))
  (gbox (* x GP) (* y GP) (* w GP) GP)))

(set! mand (lambda (mx my zoom ~ x y k)
  (set! ~ (lambda (x y l c)
    (if (< y GH)
    (if (<= GW x) (begin
      (plot l y (+ 1 (- x l)) c)
      (~ 0 (+ y 1) 0 -1))
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
  (~ 0 0 0 -1)))

(set! zoomer (lambda (zoom)
  (print "zoom" zoom "\ncoor" mandiX mandiY)
  (yield)
  (mand mandiX mandiY zoom '() '() '() '())
  (set! mandiX (+ mandiX (* (/ (- mouseX 160) GP) zoom)))
  (set! mandiY (+ mandiY (* (/ (- mouseY 100) GP) zoom)))
  (set! mouseX 160) (set! mouseY 100) ; "reset" mouse to center
  (zoomer (* zoom mandiZoom))))

(clear)
(zoomer mandiZoomStart)
