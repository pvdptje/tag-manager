<?php

use App\Livewire\Home;
use App\Livewire\One;
use App\Livewire\Two;
use Illuminate\Support\Facades\Route;

Route::get('/', Home::class)->name('home');
Route::get('/one', One::class)->name('one');
Route::get('/two', Two::class)->name('two');