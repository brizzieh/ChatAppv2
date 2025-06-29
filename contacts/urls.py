from django.urls import path
from . import views

urlpatterns = [
    path('', views.contact_list_view, name='contact_list'),
    path('add/', views.add_contact, name='add_contact'),
    path('respond/', views.respond_to_request, name='respond_to_request'),
    path('remove/', views.remove_contact, name='remove_contact'),
]
