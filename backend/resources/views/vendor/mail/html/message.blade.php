<x-mail::layout>
{{-- En-tête --}}
<x-slot:header>
<x-mail::header :url="\App\Support\MailBrand::siteUrl()">
ProtectIci
</x-mail::header>
</x-slot:header>

{{-- Corps --}}
{!! $slot !!}

{{-- Lien de secours --}}
@isset($subcopy)
<x-slot:subcopy>
<x-mail::subcopy>
{!! $subcopy !!}
</x-mail::subcopy>
</x-slot:subcopy>
@endisset

{{-- Pied de page --}}
<x-slot:footer>
@php($contact = \App\Support\MailBrand::contact())
<x-mail::footer>
**ProtectIci**, la plateforme de la sécurité privée en Côte d'Ivoire.

{{ $contact['address'] }}<br>
[{{ $contact['phone_display'] }}](tel:{{ preg_replace('/[^\d+]/', '', $contact['phone']) }}) · [{{ $contact['email'] }}](mailto:{{ $contact['email'] }})

© {{ date('Y') }} ProtectIci, une plateforme FYG Technologies.
</x-mail::footer>
</x-slot:footer>
</x-mail::layout>
