(function ($) {

    "use strict";

    var Blessed_Template    =   {

        /**
         *  Image Loader
         *  ------------
         */
        image_loader: function(){

            /**
             *  Image Loader
             *  ------------
             */
            if( $( '.masonary-active' ).length  ){

                $( '.masonary-active' ).imagesLoaded( function() {

                    var     $filter         =   '.masonary-active',

                            $filterItem     =   '.filter-item',

                            $filterMenu     =   '.filter-menu-active';

                    /**
                     *  Have Length ?
                     *  -------------
                     */
                    if ( $( $filter ).length > 0 ){

                        var     $grid   =   $( $filter ).isotope( {

                                                itemSelector    :   $filterItem,

                                                filter          :   '*',

                                                masonry         :   {   columnWidth  : 1  },

                                            } );

                        /**
                         *  When Menu Click
                         *  ---------------
                         */
                        $(  $filterMenu  ).on( 'click', 'button', function(){

                            var     filterValue     =   $(this).attr('data-filter');

                                    $grid.isotope( {

                                        filter      :   filterValue,

                                    } );
                        } );

                        /**
                         *  Active Menu Class
                         *  -----------------
                         */
                        $( $filterMenu ).on( 'click', 'button', function( event ){

                            event.preventDefault();

                            $(this).addClass('active');

                            $(this).siblings('.active').removeClass('active');

                        } );
                    }

                } );
            }
        },

        /**
         *  Image Click to Popup
         *  --------------------
         */
        magnific_popup: function(){

            /**
             *  Found Class ?
             *  -------------
             */
            if( $( '.popup-image' ).length ){

                $( '.popup-image' ).magnificPopup( {

                    type        :   'image',

                    gallery     :   {   enabled: true  },

                } );
            }
        },

        /**
         *  Count Down / Counter
         *  --------------------
         */
        counter: function(){

            /**
             *  Found Class ?
             *  -------------
             */
            if(  $('.odometer').length  ){

                $( '.odometer' ).appear(function (e) {

                    $('.odometer').each(function() {

                        $( this ).html(  $( this ).attr('data-count')  );

                    } );

                } );
            }
        },

        /**
         *  Swipper
         *  -------
         */
        swipper: function(){

            /**
             *  Found Class / Class Exists ?
             *  ----------------------------
             */
            if( $( '.blessed-sermon-slider-one' ).length ){

                $( '.blessed-sermon-slider-one' ).each( function () {
                    
                    new Swiper( '.blessed-sermon-slider-one', {

                        spaceBetween        :   30,

                        slidesPerView       :   3,

                        slidesPerGroup      :   1,

                        centeredSlides      :   false,

                        loop                :   true,

                        speed               :   1000,

                        pagination          :   {
                                                    el          :   '.blessed-sermon-slider-one-pagination',

                                                    type        :   'bullets',
                                                },

                        navigation          :   {

                                                    nextEl      : '.swiper-button-next-animate',

                                                    prevEl      : '.swiper-button-prev-animate',

                                                },

                        autoplay            :   {
                                                    delay: 10000,
                                                },

                        breakpoints         :   {
                                                    1199    : {     slidesPerView: 3  },

                                                    1024    : {     slidesPerView: 2.4  },

                                                    600     : {     slidesPerView: 2  },

                                                    575     : {     slidesPerView: 2  },

                                                    350     : {     slidesPerView: 1  },
                                                },
                    } );

                } );
            }

            /**
             *  Found Class / Class Exists ?
             *  ----------------------------
             */
            if( $( '.blessed-sermon-slider-two' ).length ){

                $( '.blessed-sermon-slider-two' ).each( function () {
                    
                    new Swiper( '.blessed-sermon-slider-two', {

                        spaceBetween        :   30,

                        slidesPerView       :   5,

                        slidesPerGroup      :   1,

                        centeredSlides      :   false,

                        loop                :   true,

                        speed               :   1000,

                        pagination          :   {
                                                    el          :   '.blessed-sermon-slider-two-pagination',

                                                    type        :   'bullets',
                                                },

                        navigation          :   {

                                                    nextEl      : '.swiper-button-next-animate',

                                                    prevEl      : '.swiper-button-prev-animate',

                                                },

                        autoplay            :   {
                                                    delay: 10000,
                                                },

                        breakpoints         :   {
                                                    1199    : {     slidesPerView: 5  },

                                                    1024    : {     slidesPerView: 3  },

                                                    600     : {     slidesPerView: 2  },

                                                    575     : {     slidesPerView: 2  },

                                                    350     : {     slidesPerView: 1  },
                                                },
                    } );

                } );
            }

            /**
             *  Found Class / Class Exists ?
             *  ----------------------------
             */
            if( $( '.blessed-campaign-slider' ).length ){

                $( '.blessed-campaign-slider' ).each( function () {
                    
                    new Swiper( '.blessed-campaign-slider', {

                        spaceBetween        :   30,

                        slidesPerView       :   3,

                        slidesPerGroup      :   1,

                        centeredSlides      :   false,

                        loop                :   true,

                        speed               :   1000,

                        pagination          :   {
                                                    el          :   '.blessed-campaign-slider-pagination',

                                                    type        :   'bullets',
                                                },

                        navigation          :   {

                                                    nextEl      : '.swiper-button-next-animate',

                                                    prevEl      : '.swiper-button-prev-animate',

                                                },

                        autoplay            :   {
                                                    delay: 10000,
                                                },

                        breakpoints         :   {
                                                    1199    : {     slidesPerView: 3  },

                                                    600     : {     slidesPerView: 2  },

                                                    575     : {     slidesPerView: 2  },

                                                    350     : {     slidesPerView: 1  },
                                                },
                    } );

                } );
            }

            /**
             *  Index 2 - Event Slider
             *  ----------------------
             */
            if( $( '.blessed-event-slider' ).length ){

                $( '.blessed-event-slider' ).each( function(){

                    new Swiper( '.blessed-event-slider', {

                        spaceBetween            :   30,

                        slidesPerView           :   1,

                        slidesPerGroup          :   1,

                        centeredSlides          :   false,

                        loop                    :   true,

                        speed                   :   1000,

                        navigation              :   {
                                                        nextEl      :   '.swiper-button-next-animate',

                                                        prevEl      :   '.swiper-button-prev-animate',
                                                    },

                        pagination              :   {
                                                        el          :   '.blessed-event-slider-pagination',

                                                        type        :   'bullets',
                                                    },

                        autoplay                :   {
                                                        delay       :   10000,
                                                    },

                        breakpoints             :   {
                                                        1199        :   {   slidesPerView   : 3   },

                                                        600         :   {   slidesPerView   : 2   },

                                                        575         :   {   slidesPerView   : 1   },

                                                        350         :   {   slidesPerView   : 1   },
                                                    },
                    } );

                } );
            }


            /**
             *  Class Found / Exists ?
             *  ----------------------
             */
            if( $( '.blessed-team' ).length ){

                $( '.blessed-team' ).each(function () {

                    new Swiper( '.blessed-team', {

                        spaceBetween            :   30,

                        slidesPerView           :   4,

                        centeredSlides          :   false,

                        loop                    :   true,

                        speed                   :   1000,

                        navigation              :   {
                                                        nextEl      :   '.swiper-button-next-4',

                                                        prevEl      :   '.swiper-button-prev-4',
                                                    },

                        pagination              :   {
                                                        el          :   '.blessed-team-pagination',

                                                        type        :   'bullets',
                                                    },

                        autoplay                :   {
                                                        delay       :   10000,
                                                    },

                        breakpoints             :   {
                                                        1199        :   {   slidesPerView   : 4   },

                                                        1024        :   {   slidesPerView   : 3   },

                                                        600         :   {   slidesPerView   : 2   },

                                                        575         :   {   slidesPerView   : 1   },

                                                        350         :   {   slidesPerView   : 1   },
                                                    }

                    } );

                } );
            }


            /**
             *  Class Found / Exists ?
             *  ----------------------
             */
            if( $( '.blessed-sermon-slider' ).length ){

                $( '.blessed-sermon-slider' ).each( function(){

                    new Swiper( '.blessed-sermon-slider', {

                        spaceBetween            :   30,

                        slidesPerView           :   2,

                        centeredSlides          :   false,

                        loop                    :   true,

                        speed                   :   1000,

                        navigation              :   {
                                                        nextEl      :   '.swiper-button-next-5',

                                                        prevEl      :   '.swiper-button-prev-5',
                                                    },

                        pagination              :   {
                                                        el          :   '.blessed-sermon-slider-pagination',

                                                        type        :   'bullets',
                                                    },

                        autoplay                :   {
                                                        delay       :   10000,
                                                    },

                        breakpoints             :   {
                                                        1199        :   {   slidesPerView   : 2   },

                                                        1024        :   {   slidesPerView   : 2   },

                                                        600         :   {   slidesPerView   : 1   },

                                                        575         :   {   slidesPerView   : 1   },

                                                        350         :   {   slidesPerView   : 1   },
                                                    }

                    } );

                } );
            }


            /**
             *  Class Found / Exists ?
             *  ----------------------
             */
            if( $( '.blessed-testimonial-slider' ).length ){

                $( '.blessed-testimonial-slider' ).each( function() {

                    new Swiper( '.blessed-testimonial-slider', {

                        spaceBetween            :   30,

                        slidesPerView           :   3,

                        centeredSlides          :   false,

                        loop                    :   true,

                        speed                   :   1000,

                        navigation              :   {
                                                        nextEl      :   '.swiper-button-next-3',

                                                        prevEl      :   '.swiper-button-prev-3',
                                                    },

                        pagination              :   {
                                                        el          :   '.blessed-testimonial-slider-pagination',

                                                        type        :   'bullets',
                                                    },

                        autoplay                :   {
                                                        delay       :   10000,
                                                    },

                        breakpoints             :   {
                                                        1199        :   {   slidesPerView   : 3   },

                                                        600         :   {   slidesPerView   : 2   },

                                                        575         :   {   slidesPerView   : 1   },

                                                        350         :   {   slidesPerView   : 1   },
                                                    }

                    } );

                } );
            }

            /**
             *  Class Found / Exists ?
             *  ----------------------
             */
            if( $( '.blessed-pastor-slider' ).length ){

                $( '.blessed-pastor-slider' ).each( function() {

                    new Swiper( '.blessed-pastor-slider', {

                        spaceBetween            :   30,

                        slidesPerView           :   3,

                        centeredSlides          :   false,

                        loop                    :   true,

                        speed                   :   1000,

                        navigation              :   {
                                                        nextEl      :   '.swiper-button-next-3',

                                                        prevEl      :   '.swiper-button-prev-3',
                                                    },

                        pagination              :   {
                                                        el          :   '.blessed-pastor-slider-pagination',

                                                        type        :   'bullets',
                                                    },

                        autoplay                :   {
                                                        delay       :   10000,
                                                    },

                        breakpoints             :   {
                                                        1199        :   {   slidesPerView   : 3   },

                                                        600         :   {   slidesPerView   : 2   },

                                                        575         :   {   slidesPerView   : 1   },

                                                        350         :   {   slidesPerView   : 1   },
                                                    }

                    } );

                } );
            }

            /**
             *  Class Found / Exists ?
             *  ----------------------
             */
            if( $( '.swiper-1-items' ).length ){

                $( '.swiper-1-items' ).each(function () {

                    new Swiper( '.swiper-1-items', {

                        spaceBetween            :   0,

                        slidesPerView           :   1,

                        loop                    :   true,

                        speed                   :   1000,

                        navigation              :   {
                                                        nextEl      :   '.swiper-button-next-1',

                                                        prevEl      :   '.swiper-button-prev-1',
                                                    },

                        autoplay                :   {
                                                        delay       :   10000,
                                                    },
                    } );

                } );
            }

            /**
             *  Class Found / Exists ?
             *  ----------------------
             */
            if( $( '.swiper-1-vertical' ).length ){

                $( '.swiper-1-vertical' ).each(function () {

                    new Swiper( '.swiper-1-vertical', {

                        direction       :   'vertical',

                        effect          :   'slide',

                        slidesPerView   :   1,

                        loop            :   true,

                        autoplay        :   {
                                                delay                   :   5000,

                                                reverseDirection        :   true,

                                                disableOnInteraction    :   false,
                                            },
                    } );

                } );
            }

            /**
             *  Class Found / Exists ?
             *  ----------------------
             */
            if( $( '.swiper-6-items' ).length ){

                $( '.swiper-6-items' ).each( function(){

                    new Swiper( '.swiper-6-items', {

                        spaceBetween            :   0,

                        slidesPerView           :   3,

                        loop                    :   true,

                        speed                   :   1000,

                        autoplay                :   {
                                                        delay       :   10000,
                                                    },

                        breakpoints             :   {
                                                        1199        :   {   slidesPerView   : 6   },

                                                        810         :   {   slidesPerView   : 4   },

                                                        600         :   {   slidesPerView   : 3   },
                                                    }
                    } );

                } );
            }
        },

        /**
         *  Menu
         *  ----
         */
        menu: function(){

            /**
             *  Contact Us Button
             *  -----------------
             */
            if( $( '.menu-tigger' ).length ){

                $( '.menu-tigger' ).on( 'click', function(){

                    $( '.offCanvas__info, .offCanvas__overly' ).addClass( 'active' );

                } );
            }

            /**
             *  Found Class
             *  -----------
             */
            if( $( '.menu-close, .offCanvas__overly' ).length ){

                $( '.menu-close, .offCanvas__overly' ).on( 'click', function(){

                    $( '.offCanvas__info, .offCanvas__overly' ).removeClass( 'active' );

                } );
            }

            /**
             *  Found Class
             *  -----------
             */
            if( $( '.tgmenu__wrap li.menu-item-has-children ul' ).length  ){

                $( '.tgmenu__wrap .navigation li.menu-item-has-children' ).append(

                    '<div class="dropdown-btn"><span class="plus-line"></span></div>'
                );
            }

            /**
             *  Mobile Menu
             *  -----------
             */
            if( $( '.tgmobile__menu' ).length ){

                /**
                 *  Found Class
                 *  -----------
                 */
                $( '.tgmobile__menu .tgmobile__menu-box .tgmobile__menu-outer' ).append(

                    $( '.tgmenu__wrap .tgmenu__main-menu' ).html()
                );
                
                /**
                 *  Dropdown Button
                 *  ---------------
                 */
                $('.tgmobile__menu li.menu-item-has-children .dropdown-btn').on('click', function () {

                    $( this ).toggleClass('open');

                    $( this ).prev('ul').slideToggle(300);

                } );
                
                /**
                 *  Menu Toggle Btn
                 *  ---------------
                 */
                $('.mobile-nav-toggler').on('click', function () {

                    $( 'body' ).addClass( 'mobile-menu-visible' );

                } );

                /**
                 *  Menu Toggle Button
                 *  ------------------
                 */
                $( '.tgmobile__menu-backdrop, .tgmobile__menu .close-btn' ).on( 'click', function(){

                    $( 'body' ).removeClass( 'mobile-menu-visible' );

                } );
            }
        },

        /**
         *  Search
         *  ------
         */
        search: function(){

            /**
             *  Found Class ?
             *  -------------
             */
            if( $( '.search-open-btn' ).length ){

                $( '.search-open-btn' ).on( 'click', function(){

                    $( '.search__popup' ).addClass( 'search-opened' );

                    $( '.search-popup-overlay' ).addClass( 'search-popup-overlay-open' );

                } );
            }

            /**
             *  Found Class ?
             *  -------------
             */
            if( $( '.search-close-btn' ).length ){

                $( '.search-close-btn' ).on( 'click', function(){

                    $( '.search__popup' ).removeClass( 'search-opened' );

                    $( '.search-popup-overlay' ).removeClass( 'search-popup-overlay-open' );

                } );
            }
        },

        /**
         *  Background
         *  ----------
         */
        background: function(){

            /**
             *  Found Attr ?
             *  ------------
             */
            if( $( '[data-background]' ).length ){

                $( '[data-background]' ).each( function(){
                    
                    $( this ).css( 'background-image', 'url(' + $(this).attr('data-background') + ')' );

                } );
            }
        },

        /**
         *  Button Click to Scroll Up
         *  -------------------------
         */
        scroll_up: function(){

            /**
             *  Found Class ?
             *  -------------
             */
            if( $( '.scroll-to-target' ).length ){

                $( '.scroll-to-target' ).on( 'click', function(){

                    $( 'html, body' ).animate( {

                        scrollTop   :   $( $(this).attr('data-target') ).offset().top,

                    }, 1000 );

                } );
            }
        },

        /**
         *  When Document load to display preloader
         *  ---------------------------------------
         */
        preloader: function(){

            /**
             *  Preloader ID exists ?
             *  ---------------------
             */
            if(  $('#preloader').length  ){

                $( '#preloader' ).delay(0).fadeOut();
            }
        },

        /**
         *  When document scroll to animation to load div content
         *  -----------------------------------------------------
         */
        wow_animation: function(){

            var     wow_animation_object       =   new WOW( {

                                                        boxClass        :   'wow',

                                                        animateClass    :   'animated',

                                                        offset          :   0,

                                                        mobile          :   false,

                                                        live            :   true,

                                                    } );

                    wow_animation_object.init();
        },

        /**
         *  AOS Animation
         *  -------------
         */
        aos_animation: function(){

            AOS.init( {

                duration        :   1000,

                mirror          :   true,

                once            :   true,

                disable         :   'mobile'

            } );
        },

        /**
         *  TG Title Animation
         *  ------------------
         */
        tg_title_animation: function(){

            gsap.registerPlugin( ScrollTrigger, SplitText );

            gsap.config( {

                nullTargetWarn      :   false,

                trialWarn           :   false

            } );

            /**
             *  Scroll
             *  ------
             */
            ScrollTrigger.addEventListener( 'refresh', function(){

                /**
                 *  Make sure class exists
                 *  ----------------------
                 */
                if ( ! $('.tg-heading-subheading').length ) {

                    return;
                }

                /**
                 *  Pass each query
                 *  ---------------
                 */
                document.querySelectorAll( ".tg-heading-subheading .tg-element-title" ).forEach( quote => {

                    /**
                     *  Reset if needed
                     *  ---------------
                     */
                    if ( quote.animation ) {

                        quote.animation.progress(1).kill();

                        quote.split.revert();
                    }

                    var     getclass    =   quote.closest('.tg-heading-subheading').className,

                            animation   =   getclass.split('animation-');


                    if( animation[1] == "style4" ){

                        return
                    }

                    quote.split     =   new SplitText( quote, {

                                            type            :   "lines,words,chars",

                                            linesClass      :   "split-line"

                                        } );

                    gsap.set( quote, { perspective: 400 } );

                    /**
                     *  Style 1
                     *  -------
                     */
                    if( animation[1] == "style1" ){

                        gsap.set( quote.split.chars, {

                            opacity     :   0,

                            y           :   "90%",

                            rotateX     :   "-40deg"

                        } );
                    }

                    /**
                     *  Style 2
                     *  -------
                     */
                    if( animation[1] == "style2" ){

                        gsap.set(quote.split.chars, {

                            opacity     :   0,

                            x           :   "50"

                        } );
                    }

                    /**
                     *  Style 3
                     *  -------
                     */
                    if( animation[1] == "style3" ){

                        gsap.set( quote.split.chars, {

                            opacity: 0,

                        } );
                    }

                    /**
                     *  Animation Start
                     *  ---------------
                     */
                    quote.animation     =   gsap.to(  quote.split.chars, {

                                                x               :   "0",

                                                y               :   "0",

                                                rotateX         :   "0",

                                                opacity         :   1,

                                                duration        :   1,

                                                ease            :   Back.easeOut,

                                                stagger         :   .02,

                                                scrollTrigger   :   {
                                                                        trigger         :   quote,

                                                                        start           :   "top 90%",
                                                                    },

                                            } );
                } );

            } );
        },

        /**
         *  Window Resize
         *  -------------
         */
        _window_resize: function(){

            var _container      =       $('main .container'),

                _window_w       =       $(window).width(),

                _container_w    =       _container.width(),

                _space          =       ( _window_w - _container_w ) / 2 - 15,

                _form_quote     =       $('.slider__area-home8 .box-form-quote');

                _form_quote.css(  'right', '' + _space + 'px');
        },

        /**
         *  Window Scroll
         *  -------------
         */
        _window_scroll: function(){

            /**
             *  Scoll Height Checking
             *  ---------------------
             */
            if( $( window ).scrollTop() < 245 ){

                if(  $( '#sticky-header' ).length  ){

                    $( '#sticky-header' ).removeClass( 'sticky-menu' );    
                }
                    
                if( $( '.scroll-to-target' ).length  ){

                    $( '.scroll-to-target' ).removeClass( 'open' );    
                }

                if(  $( '#header-fixed-height' ).length  ){

                    $( '#header-fixed-height' ).removeClass( 'active-height' );
                }
            }

            else {

                if(  $( '#sticky-header' ).length  ){

                    $( '#sticky-header').addClass( 'sticky-menu' );
                }
                    
                if( $( '.scroll-to-target' ).length  ){

                    $( '.scroll-to-target' ).addClass( 'open' );
                }

                if(  $( '#header-fixed-height' ).length  ){

                    $( '#header-fixed-height' ).addClass( 'active-height' );
                }
            }
        },

        /**
         *  Feather Icon
         *  ------------
         */
        feather_icon: function(){

            feather.replace();
        },

        /**
         *  Widnwo Load
         *  -----------
         */
        window_load: function(){

            /**
             *  When Window load to display preloader
             *  -------------------------------------
             */
            this.preloader();

            /**
             *  When document scroll to animation to load div content
             *  -----------------------------------------------------
             */
            this.wow_animation();

            /**
             *  AOS Animation
             *  -------------
             */
            this.aos_animation();

            /**
             *  TG Title Animation
             *  ------------------
             */
            this.tg_title_animation();
        },

        /**
         *  Load Script
         *  -----------
         */
        document_ready: function(){

            /**
             *  Image Loader
             *  ------------
             */
            this.image_loader();

            /**
             *  Image Click to Popup
             *  --------------------
             */
            this.magnific_popup();

            /**
             *  Count Down / Counter
             *  --------------------
             */
            this.counter();

            /**
             *  Swipper
             *  -------
             */
            this.swipper();

            /**
             *  Menu
             *  ----
             */
            this.menu();

            /**
             *  Search
             *  ------
             */
            this.search();

            /**
             *  Background
             *  ----------
             */
            this.background();

            /**
             *  Button Click to Scroll Up
             *  -------------------------
             */
            this.scroll_up();

            /**
             *  Feather Icon
             *  ------------
             */
            this.feather_icon();
        },
    }

    /**
     *  Global Declare Object
     *  ---------------------
     */
    window.Blessed_Template =   Blessed_Template;

    /**
     *  Document Ready
     *  --------------
     */
    $( document ).ready( function(){  Blessed_Template.document_ready();  } );

    /**
     *  Window Load
     *  -----------
     */
    $( window ).on( 'load', function(){  Blessed_Template.window_load();  } );

    /**
     *  Window Resize
     *  -------------
     */
    $( window ).resize( function(){  Blessed_Template._window_resize();  } ).resize();

    /**
     *  Window Scroll
     *  -------------
     */
    $( window ).on( 'scroll', function(){  Blessed_Template._window_scroll();  } );

})(jQuery);