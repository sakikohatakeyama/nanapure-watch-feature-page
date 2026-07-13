/* ============================================================
   ななぷれ 腕時計特集ページ - script.js
   ------------------------------------------------------------
   ・jQuery不要、素のJavaScriptのみで実装
   ・軽量に保つため、スクロール処理はrequestAnimationFrameで間引き
   ・お気に入りボタンは見た目確認用のダミー実装です。
     楽天の「お気に入り登録」コードに差し替えた場合、
     このファイルの該当処理（初期化 favorite ボタン部分）は不要になります。
   ============================================================ */

(function () {
  'use strict';

  var scrollContainer = document.getElementById('scrollContainer');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
     1. フェードイン演出（IntersectionObserver）
     data-animate 属性を持つ要素が画面内に入ったら is-visible を付与
     ------------------------------------------------------------ */
  function initFadeIn() {
    var targets = document.querySelectorAll('[data-animate]');
    if (!('IntersectionObserver' in window) || targets.length === 0) {
      // 非対応ブラウザは即表示にフォールバック
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.25 }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------
     2. 画像パララックス
     各セクション内の data-parallax 要素を、ビューポート中心からの
     距離に応じてわずかに上下移動させる（軽量・GPU負荷の少ない実装）
     ------------------------------------------------------------ */
  function initParallax() {
    if (prefersReducedMotion) return;

    var parallaxEls = Array.prototype.slice.call(document.querySelectorAll('[data-parallax] > img'));
    if (parallaxEls.length === 0) return;

    var ticking = false;

    function updateParallax() {
      var viewportHeight = window.innerHeight;

      parallaxEls.forEach(function (img) {
        var wrapper = img.parentElement;
        var rect = wrapper.getBoundingClientRect();
        // セクション中心とビューポート中心の距離（-1〜1程度に正規化）
        var center = rect.top + rect.height / 2 - viewportHeight / 2;
        var ratio = center / viewportHeight;
        var offset = ratio * 40; // 移動量は最大40px程度に抑えて軽く自然に

        img.style.transform = 'scale(1.08) translateY(' + offset.toFixed(1) + 'px)';
      });

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    updateParallax();
  }

  /* ------------------------------------------------------------
     3. HEROの「SCROLL」ボタン：次のセクションへスムーズスクロール
     ------------------------------------------------------------ */
  function initScrollCue() {
    var cue = document.getElementById('scrollCue');
    if (!cue) return;

    cue.addEventListener('click', function () {
      var hero = document.getElementById('hero');
      var next = hero.nextElementSibling;
      if (next) {
        next.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }
    });
  }

  /* ------------------------------------------------------------
     4. PC向け：ホイール操作の高速スナップ
     ------------------------------------------------------------
     トラックパッド／マウスホイールの慣性まかせだとセクション間の
     移動がもたついて感じるため、ホイール操作1回につき1セクション分だけ
     scrollIntoView(smooth) でジャンプさせている（ブラウザ標準の
     スムーズスクロールに任せるため軽量・安定）。
     スクロールの速さを変えたい場合は LOCK_DURATION（ミリ秒）を調整する。
     タッチ操作（スマホ）はブラウザ標準のScroll Snapに任せているため対象外。
     ------------------------------------------------------------ */
  function initFastSnap() {
    if (prefersReducedMotion) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return; // PC相当のみ対象

    var LOCK_DURATION = 700; // ← スクロール速度の調整はここ（数値を小さくすると速くなる。トラックパッドの慣性で連続ジャンプしない程度の余裕を残すこと）
    var MIN_DELTA = 30; // ← 反応の鈍感さの調整はここ（数値を上げるとちょっとした操作では反応しなくなる）
    var sections = Array.prototype.slice.call(document.querySelectorAll('.snap-section'));
    var locked = false;

    function currentIndex() {
      var top = scrollContainer.scrollTop;
      var closest = 0;
      var minDiff = Infinity;
      sections.forEach(function (sec, i) {
        var diff = Math.abs(sec.offsetTop - top);
        if (diff < minDiff) {
          minDiff = diff;
          closest = i;
        }
      });
      return closest;
    }

    function goToIndex(index) {
      index = Math.max(0, Math.min(sections.length - 1, index));
      locked = true;
      sections[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(function () { locked = false; }, LOCK_DURATION);
    }

    scrollContainer.addEventListener(
      'wheel',
      function (e) {
        if (Math.abs(e.deltaY) < MIN_DELTA) return;
        e.preventDefault();
        if (locked) return;
        goToIndex(currentIndex() + (e.deltaY > 0 ? 1 : -1));
      },
      { passive: false }
    );
  }

  /* ------------------------------------------------------------
     5. お気に入りボタン（ダミー実装）
     ------------------------------------------------------------
     楽天GOLDへ実装する際は、このブロックごと削除し、
     RMS管理画面から発行される「お気に入り登録」ボタンのコードに
     置き換えてください。
     ------------------------------------------------------------ */
  function initFavoriteButtons() {
    var buttons = document.querySelectorAll('[data-favorite]');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pressed = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!pressed));
      });
    });
  }

  /* ------------------------------------------------------------
     初期化
     ------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    initFadeIn();
    initParallax();
    initScrollCue();
    initFastSnap();
    initFavoriteButtons();
  });
})();
