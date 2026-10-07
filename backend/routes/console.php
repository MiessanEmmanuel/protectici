<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('app:purge-unverified-users')->daily();
