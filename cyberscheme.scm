;;;; Fractal Zoomer

;; Pixel Size (small=detailed/slower)
(set! GP 2)

;; Initial zoom
(set! mandiZoomStart .001)

;; Zoom speed (smaller=faster)
(set! mandiZoom .8)

;; Mandelbrot iter max (large==detailed/slower)
(set! mandiIterMax 2048)

;; Default zoom coordinates (after a reload)
;; Mouse click moves zoom location

(set! coor (list -1.6739439470203117 -0.0007817426437768488))
;(set! coor (list -0.11738394702031169 -0.6537417426437768))

(if (= mandiX ()) (begin
  (set! mandiX (car coor))
  (set! mandiY (car (cdr coor)))))

;; Constants
(set! CW (car CANVASINFO)) (set! CH (cdr CANVASINFO))
(set! CW/2 (quotient CW 2)) (set! CH/2 (quotient CH 2))
(set! GW (quotient CW GP)) ; Draw size
(set! GH (quotient CH GP))
(set! GT (* GW GH))
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

(set! plotRow (lambda (x y w c)
  (if (eq? #f c)
    (gcolor 0 0 0)
    (gcolor (sawtooth (* c 5) 255)
            (sawtooth (+ (* c 11) 23) 255)
            255))
  (gbox (* x GP) (* y GP) (* w GP) GP)))

(set! plot2 (lambda (x y w h c)
  (if (eq? #f c)
    (gcolor 0 0 0)
    (gcolor (sawtooth (* c 5) 255)
            (sawtooth (+ (* c 11) 23) 255)
            255 ))
  (gbox (* x GP) (* y GP) (* w GP) (* h GP))))

;; ==============================================

;; ==============================================

(set! boxcolors (lambda (x xl y yl m n zoom side p)
  (if (= side 0)
    (if (< xl p)
      (boxcolors x xl y yl m n zoom 1    y)
      (cons (mandi (+ m (* zoom (- p GW/2)))
                   (+ n (* zoom (- y GH/2))) '())
            (boxcolors x xl y yl m n zoom side (+ p 1))))
  (if (= side 1)
    (if (< yl p)
      (boxcolors x xl y yl m n zoom 2    x)
      (cons (mandi (+ m (* zoom (- xl GW/2)))
                   (+ n (* zoom (- p  GH/2))) '())
            (boxcolors x xl y yl m n zoom side (+ p 1))))
  (if (= side 2)
    (if (< xl p)
      (boxcolors x xl y yl m n zoom 3    y)
      (cons (mandi (+ m (* zoom (- p  GW/2)))
                   (+ n (* zoom (- yl GH/2))) '())
            (boxcolors x xl y yl m n zoom side (+ p 1))))
  (if (< yl p)
    '()
    (cons (mandi (+ m (* zoom (- x  GW/2)))
                 (+ n (* zoom (- p  GH/2))) '())
          (boxcolors x xl y yl m n zoom side (+ p 1)))))))))

; Draw all rows on canvas. Only draws same color row segments (IPC optimization)
(set! mand (lambda (mx my zoom ~ x y k)
  (set! ~ (lambda (x y l c)
    (if (< y GH)
    (if (<= GW x) (begin
      (plotRow l y (+ 1 (- x l)) c)
      (~ 0 (+ y PROCS) 0 -1))
    (begin
      (set! k (mandi (+ mx (* (- x GW/2) zoom))
                     (+ my (* (- y GH/2) zoom))
                     '()))
      (if (= k c)
        (~ (+ x 1) y l c)
        (begin
          (plotRow l y (+ 1 (- x l)) c)
          (~ (+ x 1) y (+ x 1) k)))
      )))))
  (~ 0 PROCID  0 -1)))

; Draw all points in box
(set! boxdraw (lambda (x xl y yl m n zoom i i0 kl k)
  (if (< yl y) 'done
    (if (< xl i)
      (begin
        (plot2 i0 y (- i i0 -1) 1 kl)
        (boxdraw x xl (+ y 1) yl m n zoom x x))
      (begin
        (set! k (mandi (+ m (* zoom (- i GW/2)))
                       (+ n (* zoom (- y GH/2))) '()))
        (if (< 0 (+ (= kl ()) (= k kl)))
          (boxdraw x xl y yl m n zoom (+ i 1) i0 k)
          (begin
            (plot2 i0 y (- i i0 -1) 1 kl)
            (boxdraw x xl y yl m n zoom (+ i 1) (+ i 1)))))))))

(set! same (lambda (l v)
  (if (== l ()) #t
    (if (== v (car l))
      (same (cdr l) (car l))
      #f))))

(set! boxes (lambda (m n zoom b ~ bw bh bt x y k)
  (set! bw (ceil (/ GW b))) ; Size of block grid
  (set! bh (ceil (/ GH b)))
  (set! bt (* bw bh))
  (set! ~ (lambda (i) (if (< i bt) ; over all grid blocks
   (begin
     ;(display i " ")
     (set! x  (* b (% i bw))) ;; grid x
     (set! xl (* b (% (+ i 1) bw)))
     (if (= 0 xl) (set! xl GW))
     (set! y  (* b (quotient i bw))) ;; grid y
     (set! yl (* b (% (+ (quotient i bw) 1) bh)))
     (if (= 0 yl) (set! yl GH))
     (set! k (boxcolors x (- xl 1) y (- yl 1) m n zoom 0 x))
     ;(print k)
     (if (same (cdr k) (car k))
       ;(boxdraw x xl y yl m n zoom x x '())
       (begin
         (plot2 x y (- xl x) (- yl y) (car k))
         ;(plot2 (+ x 3) (+ y 3) 3 3 #f)
         ;(plot2 (+ x 4) (+ y 4) 1 1 0)
       )
       (boxdraw x xl y yl m n zoom x x '()))

     ;(plot2 (+ x 0)    (+ y 0)    (- xl x 0) 1          k) ; up
     ;(plot2 (- xl 1 0) (+ y 0)    1          (- yl y 0) k) ; right
     ;(plot2 (+ x 0)    (- yl 1 0) (- xl x 0) 1          k) ; down
     ;(plot2 (+ x 0)    (+ y 0)    1          (- yl y 0) k) ; left
     (~ (+ i PROCS))))))
  (~ PROCID)))
;; ==============================================
    

(set! zoomer (lambda (zoom)
  (if (= 0 PROCID)
      (display (string "\n" mandiX " " mandiY " " zoom " ")))
  (boxes mandiX mandiY zoom 15)
  ;(mand mandiX mandiY zoom '() '() '())
  (sync) ; make sure all procs acquire new coordinate sanely
  ;(if (= 0 PROCID) (gclear))
  (set! mandiX (+ mandiX (* (/ (- mouseX CW/2) GP) zoom)))
  (set! mandiY (+ mandiY (* (/ (- mouseY CH/2) GP) zoom)))
  (set! mouseX CW/2) (set! mouseY CH/2) ; "reset" mouse to center
  (zoomer (* zoom mandiZoom))
))

(begin
  (clear) (sync) (if (= 0 PROCID) (display 'Procs: PROCS))
  (zoomer mandiZoomStart)
)
