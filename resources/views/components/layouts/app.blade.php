<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>{{ $title ?? 'Page Title' }}</title>
    <!-- Google Tag Manager -->
    <script>
        (function(w, d, s, l, i) {
            w[l] = w[l] || [];
            w[l].push({
                'gtm.start': new Date().getTime(),
                event: 'gtm.js'
            });
            var f = d.getElementsByTagName(s)[0],
                j = d.createElement(s),
                dl = l != 'dataLayer' ? '&l=' + l : '';
            j.async = true;
            j.src =
                'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
            f.parentNode.insertBefore(j, f);
        })(window, document, 'script', 'dataLayer', 'GTM-PZKCGLVD');
    </script>
    <!-- End Google Tag Manager -->
    {{-- <script>
        document.addEventListener('livewire:navigating', () => {
            if (window.Intercom) {
                window.Intercom('shutdown');
            }
        });
        document.addEventListener('livewire:navigated', () => {
            if (window.Intercom) {
                window.Intercom('boot', {
                    app_id: 'inzkj8rb',
                });
            }
        });
    </script> --}}
    <script>
        const APP_ID = 'inzkj8rb';
        (function() {
            var w = window;
            var ic = w.Intercom;
            if (typeof ic === "function") {
                ic('update', w.intercomSettings);
            } else {
                var d = document;
                var i = function() {
                    i.c(arguments);
                };
                i.q = [];
                i.c = function(args) {
                    i.q.push(args);
                };
                w.Intercom = i;
                var l = function() {
                    var s = d.createElement('script');
                    s.type = 'text/javascript';
                    s.async = true;
                    s.src = 'https://widget.intercom.io/widget/' + APP_ID;
                    var x = d.getElementsByTagName('script')[0];
                    x.parentNode.insertBefore(s, x);
                };
                window.l = l;
                if (document.readyState === 'complete') {
                    l();
                } else if (w.attachEvent) {
                    w.attachEvent('onload', l);
                } else {
                    w.addEventListener('load', l, false);
                }
            }
        })();
    </script>
    <script>
        window.intercomSettings = {
            app_id: "inzkj8rb",
            api_base: "https://api-iam.eu.intercom.io"
        };
        window.Intercom('boot', {
            app_id: 'inzkj8rb',
        });
    </script>
 @vite(['resources/css/app.css', 'resources/js/app.js'])

</head>

<body>
    {{ $slot }}
    <div id="livewire-preserve-marker" style="display: none;" aria-hidden="true"></div>

</body>

</html>