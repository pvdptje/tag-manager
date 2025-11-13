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
        })(window, document, 'script', 'dataLayer', 'GTM-5QWCNDH6');
    </script>
    <!-- End Google Tag Manager -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            document.addEventListener('livewire:navigated', () => {
                console.log('Sending page view.');
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({
                    'event': 'site-navigated',
                    'page_path': window.location.pathname + window.location.search
                });
            });
        });
    </script>
</head>

<body>
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5QWCNDH6" height="0" width="0"
            style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
    {{ $slot }}


    <img src="/images/trigger.png" />
    <br />
    <img src="/images/tag.png" />

</body>

</html>
